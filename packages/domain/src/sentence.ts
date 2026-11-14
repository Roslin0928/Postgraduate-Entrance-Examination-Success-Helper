export type SentenceMode = 'detailed' | 'brief';
export type SentenceChunkRole = 'subject' | 'verb' | 'object' | 'clause' | 'modifier' | 'other';
export type SentenceAnalysisStatus = 'pending' | 'completed' | 'retryable';
export type SentenceUnderstandingStatus = 'understood' | 'needs_review';

export interface SentenceAnalysisResult {
  original: string;
  chunks: Array<{ text: string; role: SentenceChunkRole }>;
  mainClause: string;
  grammarPoints: string[];
  literalTranslation: string;
  naturalTranslation: string;
}

export interface SentenceAnalysisView extends SentenceAnalysisResult {
  id: string;
  mode: SentenceMode;
  status: SentenceAnalysisStatus;
  understandingStatus: SentenceUnderstandingStatus;
  errorMessage: string | null;
  createdAt: string;
}
