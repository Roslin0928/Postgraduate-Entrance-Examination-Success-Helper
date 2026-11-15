import { FakeAnalysisProvider } from '../src/modules/sentences/fake-analysis-provider';

describe('FakeAnalysisProvider', () => {
  it('returns detailed structure with clause, grammar, and both translations', async () => {
    const result = await new FakeAnalysisProvider().analyze(
      'Although the method seems simple, it produces results that researchers can verify.',
      'detailed',
    );

    expect(result.original).toContain('Although');
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.mainClause).toBeTruthy();
    expect(result.grammarPoints.length).toBeGreaterThan(0);
    expect(result.literalTranslation).toBeTruthy();
    expect(result.naturalTranslation).toBeTruthy();
  });

  it('keeps the original sentence in brief mode', async () => {
    const sentence = 'The result surprised us.';
    await expect(new FakeAnalysisProvider().analyze(sentence, 'brief')).resolves.toMatchObject({ original: sentence });
  });
});
