import type { ImportError, NewWord } from '@kaoyan/domain';

export interface ImportParseOptions {
  maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 1_000_000;

export function parseVocabularyImport(
  input: string,
  options: ImportParseOptions = {},
): { words: NewWord[]; errors: ImportError[] } {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  if (Buffer.byteLength(input, 'utf8') > maxBytes) throw new Error(`File exceeds ${maxBytes} bytes`);

  const lines = input.replace(/^\uFEFF/, '').split(/\r?\n/);
  const nonEmpty = lines.map((line, index) => ({ line, number: index + 1 })).filter(({ line }) => line.trim());
  if (!nonEmpty.length) return { words: [], errors: [] };
  const delimiter = nonEmpty[0].line.includes('\t') ? '\t' : ',';
  const words: NewWord[] = [];
  const errors: ImportError[] = [];
  const seen = new Set<string>();

  for (const { line, number } of nonEmpty) {
    const columns = splitRow(line, delimiter);
    if (columns.length === 2 && number === nonEmpty[0].number &&
      columns[0].trim().toLowerCase() === 'word' && columns[1].trim().toLowerCase() === 'meaning') continue;
    if (columns.length > 2) { errors.push({ line: number, reason: 'too_many_columns' }); continue; }
    const word = (columns[0] ?? '').trim();
    const meaning = (columns[1] ?? '').trim();
    if (!word) { errors.push({ line: number, reason: 'missing_word' }); continue; }
    if (!meaning) { errors.push({ line: number, reason: 'missing_meaning' }); continue; }
    const key = word.toLocaleLowerCase();
    if (seen.has(key)) { errors.push({ line: number, reason: 'duplicate' }); continue; }
    seen.add(key);
    words.push({ word, meaning, source: 'imported' });
  }
  return { words, errors };
}

function splitRow(row: string, delimiter: string): string[] {
  const columns: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    if (char === '"') {
      if (quoted && row[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      columns.push(value); value = '';
    } else value += char;
  }
  columns.push(value);
  return columns;
}
