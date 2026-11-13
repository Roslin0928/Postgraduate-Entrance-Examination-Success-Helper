import type { SentenceAnalysisResult, SentenceMode } from '@kaoyan/domain';

export interface SentenceAnalysisProvider {
  analyze(input: string, mode: SentenceMode): Promise<SentenceAnalysisResult>;
}

export const SENTENCE_ANALYSIS_PROVIDER = Symbol('SENTENCE_ANALYSIS_PROVIDER');

export class HttpAnalysisProvider implements SentenceAnalysisProvider {
  constructor(private readonly endpoint = process.env.SENTENCE_ANALYSIS_URL, private readonly apiKey = process.env.SENTENCE_ANALYSIS_API_KEY) {
    if (!endpoint) throw new Error('SENTENCE_ANALYSIS_URL is required for the production sentence analysis provider');
  }

  async analyze(input: string, mode: SentenceMode): Promise<SentenceAnalysisResult> {
    const response = await fetch(this.endpoint!, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}) },
      body: JSON.stringify({ sentence: input, mode }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Sentence analysis provider returned HTTP ${response.status}`);
    const result = await response.json() as SentenceAnalysisResult;
    if (!result || typeof result.mainClause !== 'string' || !Array.isArray(result.chunks) || !Array.isArray(result.grammarPoints) ||
      typeof result.literalTranslation !== 'string' || typeof result.naturalTranslation !== 'string') {
      throw new Error('Sentence analysis provider returned an invalid response');
    }
    return { ...result, original: input };
  }
}
