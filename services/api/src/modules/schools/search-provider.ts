import type { NormalizedSchoolQuery, SchoolSearchResult } from '@kaoyan/domain';

export interface SchoolSearchProvider {
  search(query: NormalizedSchoolQuery): Promise<SchoolSearchResult>;
}

export const SCHOOL_SEARCH_PROVIDER = 'SCHOOL_SEARCH_PROVIDER';
