import { parseVocabularyImport } from '../src/modules/vocabulary/import-parser';

describe('parseVocabularyImport', () => {
  it('parses CSV with optional header and ignores blank lines', () => {
    expect(parseVocabularyImport('word,meaning\napple,苹果\n\nbook,书').words).toEqual([
      { word: 'apple', meaning: '苹果', source: 'imported' },
      { word: 'book', meaning: '书', source: 'imported' },
    ]);
  });

  it('parses quoted CSV fields and TSV', () => {
    expect(parseVocabularyImport('"take, off","起飞, 脱下"').words[0].meaning).toBe('起飞, 脱下');
    expect(parseVocabularyImport('word\tmeaning\nlook up\t查找').words[0].word).toBe('look up');
  });

  it('reports malformed and duplicate rows with physical line numbers', () => {
    const result = parseVocabularyImport('word,meaning\n,空词\nhello,\nhello,你好\nhello,重复\na,b,c');
    expect(result.words).toEqual([{ word: 'hello', meaning: '你好', source: 'imported' }]);
    expect(result.errors).toEqual([
      { line: 2, reason: 'missing_word' },
      { line: 3, reason: 'missing_meaning' },
      { line: 5, reason: 'duplicate' },
      { line: 6, reason: 'too_many_columns' },
    ]);
  });

  it('rejects files above the configured byte limit', () => {
    expect(() => parseVocabularyImport('word,meaning', { maxBytes: 4 })).toThrow('File exceeds 4 bytes');
  });
});
