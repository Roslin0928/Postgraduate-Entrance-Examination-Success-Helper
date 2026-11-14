import type { NormalizedSchoolQuery, SchoolSearchResult } from '@kaoyan/domain';
import type { SchoolSearchProvider } from './search-provider';

export class UnavailableSearchProvider implements SchoolSearchProvider {
  async search(_query: NormalizedSchoolQuery): Promise<SchoolSearchResult> {
    throw new Error('School search provider is not configured');
  }
}
