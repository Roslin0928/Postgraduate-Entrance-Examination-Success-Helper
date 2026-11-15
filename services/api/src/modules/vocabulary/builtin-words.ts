import type { NewWord } from '@kaoyan/domain';

export const BUILTIN_EXAM_WORDS: ReadonlyArray<Omit<NewWord, 'source'>> = [
  { word: 'abandon', meaning: '放弃；抛弃' },
  { word: 'abbreviate', meaning: '缩写；缩短' },
  { word: 'abstract', meaning: '抽象的；摘要' },
  { word: 'abundant', meaning: '丰富的；充裕的' },
  { word: 'academic', meaning: '学术的；学者' },
];
