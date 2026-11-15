import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { NormalizedSchoolQuery, SchoolQueryView, SchoolSearchItem } from '@kaoyan/domain';
import { PrismaService } from '../../prisma.service';
import { SCHOOL_SEARCH_PROVIDER, SchoolSearchProvider } from './search-provider';

const SEARCH_TIMEOUT_MS = 5000;
const STALE_AFTER_MS = 180 * 24 * 60 * 60 * 1000;

@Injectable()
export class SchoolsService {
  constructor(private readonly prisma: PrismaService, @Inject(SCHOOL_SEARCH_PROVIDER) private readonly provider: SchoolSearchProvider) {}

  async create(accountId: string, instruction: string) {
    if (typeof instruction !== 'string' || !instruction.trim() || instruction.length > 500) throw new BadRequestException('instruction must be 1 to 500 characters');
    const normalized = normalizeInstruction(instruction);
    const row = await this.prisma.schoolQuery.create({ data: { accountId, instruction: instruction.trim(), query: JSON.stringify(normalized), status: 'pending' } });
    try {
      const result = await withTimeout(this.provider.search(normalized), SEARCH_TIMEOUT_MS);
      validateResult(result);
      const saved = await this.prisma.schoolQuery.update({ where: { id: row.id }, data: {
        results: JSON.stringify(result.items), status: result.items.length ? 'completed' : 'no_results',
        reason: result.items.length ? null : '没有找到匹配结果，请修改条件后重试。', searchedAt: new Date(result.searchedAt),
      } });
      return this.view(saved);
    } catch (error) {
      const reason = error instanceof Error && error.message === 'Search timed out'
        ? '搜索超时，请稍后重试或修改条件。'
        : '搜索暂时不可用，请稍后重试或修改条件。';
      const saved = await this.prisma.schoolQuery.update({ where: { id: row.id }, data: { status: 'retryable', reason } });
      return this.view(saved);
    }
  }

  async get(accountId: string, id: string) {
    const row = await this.prisma.schoolQuery.findFirst({ where: { id, accountId } });
    if (!row) throw new NotFoundException('School query not found');
    return this.view(row);
  }

  private view(row: any): SchoolQueryView {
    const parse = (value: string, fallback: any) => { try { return JSON.parse(value); } catch { return fallback; } };
    const results = parse(row.results, []) as SchoolSearchItem[];
    const stale = results.some((item) => {
      const updated = Date.parse(item.updatedAt);
      return !Number.isFinite(updated) || Date.now() - updated > STALE_AFTER_MS;
    });
    return {
      id: row.id, instruction: row.instruction, query: parse(row.query, { constraints: [] }), results,
      status: row.status, reason: stale ? '部分资料更新时间较早，请以来源页面的最新公告为准。' : row.reason,
      searchedAt: row.searchedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(),
    };
  }
}

export function normalizeInstruction(instruction: string): NormalizedSchoolQuery {
  const text = instruction.trim();
  const yearMatch = text.match(/(20\d{2})\s*年?/);
  const regions = ['北京', '上海', '天津', '重庆', '江苏', '浙江', '广东', '湖北', '四川', '陕西', '山东', '湖南', '福建', '辽宁', '吉林', '黑龙江', '安徽', '江西', '河南', '河北', '山西', '云南', '贵州', '甘肃', '青海', '海南', '内蒙古', '广西', '西藏', '宁夏', '新疆'];
  const region = regions.find((name) => text.includes(name));
  const majors = ['计算机', '软件工程', '电子信息', '金融', '教育', '法律', '机械', '临床医学', '新闻传播', '管理'];
  const major = majors.find((name) => text.includes(name));
  const constraints = ['双一流', '985', '211', '学硕', '专硕'].filter((term) => text.includes(term));
  const schoolType = ['双一流', '985', '211'].find((term) => text.includes(term));
  return { ...(yearMatch ? { year: Number(yearMatch[1]) } : {}), ...(major ? { major } : {}), ...(region ? { region } : {}), ...(schoolType ? { schoolType } : {}), constraints };
}

function validateResult(result: any): asserts result is { items: SchoolSearchItem[]; searchedAt: string } {
  if (!result || !Array.isArray(result.items) || typeof result.searchedAt !== 'string' || !Number.isFinite(Date.parse(result.searchedAt))) throw new Error('Invalid search provider result');
  for (const item of result.items) {
    if (!item || typeof item.schoolName !== 'string' || !(item.majorName === null || typeof item.majorName === 'string') ||
      !item.fields || typeof item.fields !== 'object' || typeof item.sourceUrl !== 'string' || typeof item.sourceName !== 'string' ||
      typeof item.updatedAt !== 'string' || !Number.isFinite(Date.parse(item.updatedAt))) throw new Error('Invalid search provider item');
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Search timed out')), timeoutMs);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}
