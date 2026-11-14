import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SentenceAnalysisResult, SentenceMode, SentenceUnderstandingStatus } from '@kaoyan/domain';
import { PrismaService } from '../../prisma.service';
import { SENTENCE_ANALYSIS_PROVIDER, SentenceAnalysisProvider } from './analysis-provider';

@Injectable()
export class SentencesService {
  constructor(private readonly prisma: PrismaService, @Inject(SENTENCE_ANALYSIS_PROVIDER) private readonly provider: SentenceAnalysisProvider) {}

  async create(accountId: string, original: string, mode: SentenceMode = 'detailed') {
    this.validateInput(original, mode);
    const record = await this.prisma.sentenceAnalysis.create({
      data: { accountId, original: original.trim(), mode, status: 'pending', understandingStatus: 'needs_review' },
    });
    return this.runAnalysis(record);
  }

  async retry(accountId: string, id: string) {
    const record = await this.prisma.sentenceAnalysis.findFirst({ where: { id, accountId } });
    if (!record) throw new NotFoundException('Sentence analysis not found');
    if (record.status !== 'retryable') throw new BadRequestException('Only retryable analyses can be retried');
    await this.prisma.sentenceAnalysis.update({ where: { id }, data: { status: 'pending', errorMessage: null } });
    return this.runAnalysis({ ...record, status: 'pending', errorMessage: null });
  }

  async history(accountId: string) {
    const records = await this.prisma.sentenceAnalysis.findMany({ where: { accountId }, orderBy: { createdAt: 'desc' } });
    return records.map((record: any) => this.view(record));
  }

  async updateUnderstanding(accountId: string, id: string, status: SentenceUnderstandingStatus) {
    const existing = await this.prisma.sentenceAnalysis.findFirst({ where: { id, accountId } });
    if (!existing) throw new NotFoundException('Sentence analysis not found');
    const record = await this.prisma.sentenceAnalysis.update({ where: { id }, data: { understandingStatus: status } });
    return this.view(record);
  }

  private async runAnalysis(record: any) {
    try {
      const result = await this.provider.analyze(record.original, record.mode);
      this.validateResult(result, record.original, record.mode);
      const completed = await this.prisma.sentenceAnalysis.update({
        where: { id: record.id },
        data: { ...this.serializeResult(result), status: 'completed', errorMessage: null },
      });
      return this.view(completed);
    } catch (error) {
      const retryable = await this.prisma.sentenceAnalysis.update({
        where: { id: record.id },
        data: { status: 'retryable', errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'Analysis failed; please retry' },
      });
      return this.view(retryable);
    }
  }

  private validateInput(original: string, mode: string): void {
    if (typeof original !== 'string' || !original.trim()) throw new BadRequestException('sentence must be a non-empty string');
    if (original.trim().length > 2000) throw new BadRequestException('sentence must be 2,000 characters or fewer');
    if (!['detailed', 'brief'].includes(mode)) throw new BadRequestException('mode must be detailed or brief');
  }

  private validateResult(result: SentenceAnalysisResult, original: string, mode: SentenceMode): void {
    if (!result || !Array.isArray(result.chunks) || typeof result.mainClause !== 'string' || !Array.isArray(result.grammarPoints) ||
      !result.grammarPoints.every((point) => typeof point === 'string') || typeof result.literalTranslation !== 'string' ||
      typeof result.naturalTranslation !== 'string') {
      throw new Error('Analysis provider returned an invalid result');
    }
    for (const chunk of result.chunks) {
      if (!chunk || typeof chunk.text !== 'string' || !['subject', 'verb', 'object', 'clause', 'modifier', 'other'].includes(chunk.role)) {
        throw new Error('Analysis provider returned invalid sentence chunks');
      }
    }
    if (!result.mainClause.trim() || !result.naturalTranslation.trim()) {
      throw new Error('Analysis provider returned an incomplete sentence analysis');
    }
    if (mode === 'detailed' && (result.chunks.length === 0 || !result.grammarPoints.some((point) => point.trim()) ||
      !result.literalTranslation.trim())) {
      throw new Error('Analysis provider returned an incomplete detailed sentence analysis');
    }
    result.original = original;
  }

  private serializeResult(result: SentenceAnalysisResult) {
    return {
      chunks: JSON.stringify(result.chunks), mainClause: result.mainClause, grammarPoints: JSON.stringify(result.grammarPoints),
      literalTranslation: result.literalTranslation, naturalTranslation: result.naturalTranslation,
    };
  }

  private view(record: any) {
    const parse = (value: string, fallback: unknown) => { try { return JSON.parse(value); } catch { return fallback; } };
    return {
      id: record.id, original: record.original, mode: record.mode, status: record.status,
      understandingStatus: record.understandingStatus, chunks: parse(record.chunks, []), mainClause: record.mainClause,
      grammarPoints: parse(record.grammarPoints, []), literalTranslation: record.literalTranslation,
      naturalTranslation: record.naturalTranslation, errorMessage: record.errorMessage, createdAt: record.createdAt,
    };
  }
}
