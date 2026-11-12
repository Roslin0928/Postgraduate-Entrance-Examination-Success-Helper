import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { WordSource } from '@kaoyan/domain';
import { scheduleWordReview, ReviewFeedback } from './review-scheduler';
import { PrismaService } from '../../prisma.service';
import { parseVocabularyImport } from './import-parser';
import { BUILTIN_EXAM_WORDS } from './builtin-words';

const ALLOWED_ZONES = new Set(Intl.supportedValuesOf('timeZone'));

@Injectable()
export class VocabularyService {
  constructor(private readonly prisma: PrismaService) {}

  async getDueWords(accountId: string, now = new Date(), timeZone = 'UTC') {
    const zone = this.timeZone(timeZone);
    const plannedDate = localDate(now, zone);
    await this.ensureBuiltinWords(accountId, now);
    let task = await this.prisma.task.findFirst({ where: { accountId, type: 'vocabulary', plannedDate: utcDate(plannedDate) } });
    if (!task) {
      task = await this.prisma.task.create({
        data: { accountId, type: 'vocabulary', title: '考研词汇复习', plannedMinutes: 15, plannedDate: utcDate(plannedDate), priority: 0 },
      });
    }
    const due = await this.prisma.userWord.findMany({
      where: { accountId, nextReviewAt: { lte: now }, word: { OR: [{ source: 'builtin_exam' }, { ownerAccountId: accountId }] } },
      include: { word: true }, orderBy: [{ nextReviewAt: 'asc' }, { id: 'asc' }],
    });
    return { items: due.map((entry: any) => ({ id: entry.word.id, word: entry.word.word, meaning: entry.word.meaning, source: entry.word.source, nextReviewAt: entry.nextReviewAt })), count: due.length, taskId: task.id };
  }

  private async ensureBuiltinWords(accountId: string, now: Date): Promise<void> {
    for (const item of BUILTIN_EXAM_WORDS) {
      const normalizedWord = item.word.toLocaleLowerCase();
      let word = await this.prisma.word.findFirst({ where: { source: 'builtin_exam', normalizedWord, ownerAccountId: null } });
      if (!word) {
        word = await this.prisma.word.create({ data: { ...item, normalizedWord, source: 'builtin_exam', ownerAccountId: null } });
      }
      await this.prisma.userWord.upsert({
        where: { accountId_wordId: { accountId, wordId: word.id } },
        create: { accountId, wordId: word.id, nextReviewAt: now },
        update: {},
      });
    }
  }

  async reviewWord(accountId: string, wordId: string, feedback: ReviewFeedback, taskId?: string, timeZone = 'UTC', now = new Date()) {
    if (!['unknown', 'fuzzy', 'known'].includes(feedback)) throw new BadRequestException('feedback must be unknown, fuzzy, or known');
    const word = await this.prisma.word.findFirst({ where: { id: wordId, OR: [{ source: 'builtin_exam' }, { ownerAccountId: accountId }] } });
    if (!word) throw new NotFoundException('Word not found');
    if (taskId) {
      const task = await this.prisma.task.findFirst({ where: { id: taskId, accountId, type: 'vocabulary' } });
      if (!task) throw new NotFoundException('Vocabulary task not found');
    }
    const prior = await this.prisma.userWord.findUnique({ where: { accountId_wordId: { accountId, wordId } } });
    const streak = feedback === 'known' ? (prior?.consecutiveKnown ?? 0) + 1 : 0;
    const schedule = scheduleWordReview(feedback, now, feedback === 'known' ? streak - 1 : 0, this.timeZone(timeZone));
    const result = await this.prisma.$transaction(async (tx: any) => {
      const userWord = await tx.userWord.upsert({
        where: { accountId_wordId: { accountId, wordId } },
        create: { accountId, wordId, nextReviewAt: schedule.nextReviewAt, consecutiveKnown: streak, lastReviewedAt: now },
        update: { nextReviewAt: schedule.nextReviewAt, consecutiveKnown: streak, lastReviewedAt: now },
      });
      await tx.wordReview.create({ data: { accountId, userWordId: userWord.id, taskId: taskId ?? null, feedback, reviewedAt: now } });
      return userWord;
    });
    return { wordId, feedback, nextReviewAt: result.nextReviewAt, repeatInSession: schedule.repeatInSession };
  }

  async createCustomWord(accountId: string, word: string, meaning: string) {
    return this.saveWords(accountId, [{ word, meaning, source: 'custom' }]);
  }

  async importWords(accountId: string, fileName: string, content: string) {
    if (typeof fileName !== 'string' || !fileName.trim()) throw new BadRequestException('fileName is required');
    let parsed: ReturnType<typeof parseVocabularyImport>;
    try { parsed = parseVocabularyImport(content); }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Invalid import file'); }
    const result = await this.saveWords(accountId, parsed.words);
    const totalRows = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim()).length;
    const header = content.trimStart().split(/\r?\n/)[0]?.trim().toLowerCase();
    const hasHeader = header === 'word,meaning' || header === 'word\tmeaning';
    const log = await this.prisma.vocabularyImport.create({
      data: {
        accountId, fileName: fileName.trim(), totalRows: Math.max(0, totalRows - (hasHeader ? 1 : 0)),
        successCount: result.length, errorRows: JSON.stringify(parsed.errors),
      },
    });
    return { importId: log.id, totalRows: log.totalRows, successCount: result.length, errors: parsed.errors };
  }

  private async saveWords(accountId: string, words: Array<{ word: string; meaning: string; source: WordSource }>) {
    const saved: any[] = [];
    for (const item of words) {
      const wordText = item.word.trim();
      const meaning = item.meaning.trim();
      if (!wordText || !meaning) throw new BadRequestException('word and meaning are required');
      const normalizedWord = wordText.toLocaleLowerCase();
      const word = await this.prisma.word.upsert({
        where: { ownerAccountId_normalizedWord: { ownerAccountId: accountId, normalizedWord } },
        create: { word: wordText, normalizedWord, meaning, source: item.source, ownerAccountId: accountId },
        update: { meaning },
      });
      await this.prisma.userWord.upsert({
        where: { accountId_wordId: { accountId, wordId: word.id } },
        create: { accountId, wordId: word.id, nextReviewAt: new Date(0) },
        update: {},
      });
      saved.push({ id: word.id, word: word.word, meaning: word.meaning, source: word.source });
    }
    return saved;
  }

  private timeZone(value: string): string {
    if (typeof value !== 'string' || (value !== 'UTC' && !ALLOWED_ZONES.has(value))) throw new BadRequestException('timeZone must be a valid IANA timezone');
    return value;
  }
}

function localDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function utcDate(date: string): Date { return new Date(`${date}T00:00:00.000Z`); }
