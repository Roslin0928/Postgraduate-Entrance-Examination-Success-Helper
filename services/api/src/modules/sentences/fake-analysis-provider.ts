import type { SentenceAnalysisProvider } from './analysis-provider';
import type { SentenceAnalysisResult, SentenceMode } from '@kaoyan/domain';

export class FakeAnalysisProvider implements SentenceAnalysisProvider {
  async analyze(input: string, mode: SentenceMode): Promise<SentenceAnalysisResult> {
    const parts = input.split(/(,|;|:)/).filter((part) => part.length > 0);
    const chunks = parts.map((text, index) => ({
      text: text.trim(),
      role: /^(,|;|:)$/.test(text) ? 'other' as const : index === 0 ? 'subject' as const : 'clause' as const,
    })).filter((part) => part.text);
    return {
      original: input,
      chunks,
      mainClause: input.replace(/^(although|because|when|while|if)\b[^,]*,\s*/i, '').trim() || input,
      grammarPoints: mode === 'detailed' ? ['分析句子主干，识别连接词引导的从句，再判断修饰关系。'] : ['先找谓语动词，再定位主语和从句。'],
      literalTranslation: '按英文语序直译：' + input,
      naturalTranslation: '自然译文（示例）：' + input,
    };
  }
}
