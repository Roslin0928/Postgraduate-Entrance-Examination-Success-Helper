export interface NormalizedSchoolQuery {
  year?: number;
  major?: string;
  region?: string;
  schoolType?: string;
  constraints: string[];
}

export interface SchoolSearchItem {
  schoolName: string;
  majorName: string | null;
  fields: Record<string, string | number | null>;
  sourceUrl: string;
  sourceName: string;
  updatedAt: string;
}

export interface SchoolSearchResult {
  items: SchoolSearchItem[];
  searchedAt: string;
}

export interface SchoolQueryView {
  id: string;
  instruction: string;
  query: NormalizedSchoolQuery;
  results: SchoolSearchItem[];
  status: 'completed' | 'no_results' | 'retryable';
  reason: string | null;
  searchedAt: string | null;
  createdAt: string;
}
