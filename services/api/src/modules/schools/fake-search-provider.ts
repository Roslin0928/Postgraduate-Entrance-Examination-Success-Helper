import type { NormalizedSchoolQuery, SchoolSearchResult } from '@kaoyan/domain';
import type { SchoolSearchProvider } from './search-provider';

export class FakeSearchProvider implements SchoolSearchProvider {
  async search(query: NormalizedSchoolQuery): Promise<SchoolSearchResult> {
    const candidates = [
      { schoolName: '北京示例大学', majorName: query.major ?? '计算机科学与技术', fields: { region: '北京', schoolType: '双一流', note: '人工配置的演示数据' }, sourceUrl: 'https://example.edu.cn/admissions', sourceName: '示例大学招生信息（演示）', updatedAt: '2026-11-01T00:00:00.000Z' },
      { schoolName: '华东示例大学', majorName: query.major ?? '软件工程', fields: { region: '上海', schoolType: '双一流', note: '人工配置的演示数据' }, sourceUrl: 'https://example-east.edu.cn/admissions', sourceName: '华东示例大学招生信息（演示）', updatedAt: '2026-11-01T00:00:00.000Z' },
    ];
    const items = candidates.filter((candidate) => !query.region || candidate.fields.region === query.region);
    return { items, searchedAt: new Date().toISOString() };
  }
}
