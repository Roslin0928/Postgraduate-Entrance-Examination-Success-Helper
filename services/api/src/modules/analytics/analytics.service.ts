import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

const TIME_ZONES = new Set(Intl.supportedValuesOf('timeZone'));
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async daily(accountId: string, date: string, timeZone = 'UTC') {
    this.validateDate(date);
    const zone = this.validateTimeZone(timeZone);
    const { start, end } = localDayBounds(date, zone);
    const { start: plannedDateStart, end: plannedDateEnd } = utcDateBucket(date);
    const [tasks, sessions, reviews, analyses] = await Promise.all([
      this.prisma.task.findMany({ where: { accountId, plannedDate: { gte: plannedDateStart, lt: plannedDateEnd } } }),
      this.prisma.pomodoroSession.findMany({ where: { task: { accountId }, status: { in: ['completed', 'paused'] }, startedAt: { gte: start, lt: end } } }),
      this.prisma.wordReview.findMany({ where: { accountId, reviewedAt: { gte: start, lt: end } } }),
      this.prisma.sentenceAnalysis.findMany({ where: { accountId, status: 'completed', createdAt: { gte: start, lt: end } } }),
    ]);
    const effectiveSeconds = sessions.reduce((total: number, session: any) => total + (session.accumulatedSeconds ?? 0), 0);
    return {
      date,
      plannedTasks: tasks.length,
      completedTasks: tasks.filter((task: any) => task.status === 'completed').length,
      effectiveMinutes: Math.floor(effectiveSeconds / 60),
      vocabularyReviews: reviews.length,
      vocabularyFamiliarityChange: reviews.reduce((change: number, review: any) => change + (review.feedback === 'known' ? 1 : review.feedback === 'unknown' ? -1 : 0), 0),
      sentenceAnalyses: analyses.length,
    };
  }

  async weekly(accountId: string, date: string, timeZone = 'UTC') {
    this.validateDate(date);
    this.validateTimeZone(timeZone);
    const anchor = new Date(`${date}T00:00:00.000Z`);
    const monday = new Date(anchor);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const dates = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(monday.getTime() + index * DAY_MS);
      return day.toISOString().slice(0, 10);
    });
    return { weekStart: dates[0], weekEnd: dates[6], days: await Promise.all(dates.map((day) => this.daily(accountId, day, timeZone))) };
  }

  private validateDate(date: string): void {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) {
      throw new BadRequestException('date must use YYYY-MM-DD');
    }
  }

  private validateTimeZone(value: string): string {
    if (typeof value !== 'string' || (value !== 'UTC' && !TIME_ZONES.has(value))) throw new BadRequestException('timeZone must be a valid IANA timezone');
    return value;
  }
}

function utcDateBucket(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const start = Date.UTC(year, month - 1, day);
  return { start: new Date(start), end: new Date(start + DAY_MS) };
}

function localDayBounds(date: string, timeZone: string) {
  const [year, month, day] = date.split('-').map(Number);
  const localMidnightAsUtc = Date.UTC(year, month - 1, day);
  return {
    start: localTimeToUtc(localMidnightAsUtc, timeZone),
    end: localTimeToUtc(localMidnightAsUtc + DAY_MS, timeZone),
  };
}

function localTimeToUtc(localUtc: number, timeZone: string): Date {
  let candidate = localUtc;
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(candidate));
    const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    const represented = Date.UTC(Number(fields.year), Number(fields.month) - 1, Number(fields.day), Number(fields.hour), Number(fields.minute), Number(fields.second));
    candidate += localUtc - represented;
  }
  return new Date(candidate);
}
