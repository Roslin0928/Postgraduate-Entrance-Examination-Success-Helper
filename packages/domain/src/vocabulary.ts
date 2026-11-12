export type WordSource = 'builtin_exam' | 'custom' | 'imported';
export type ReviewFeedback = 'unknown' | 'fuzzy' | 'known';

export interface NewWord {
  word: string;
  meaning: string;
  source: WordSource;
}

export interface ImportError {
  line: number;
  reason: 'missing_word' | 'missing_meaning' | 'too_many_columns' | 'duplicate';
}

export function scheduleWordReview(
  feedback: ReviewFeedback,
  now: Date,
  consecutiveKnown: number,
  timeZone = 'UTC',
): { nextReviewAt: Date; repeatInSession: boolean } {
  const days = feedback === 'unknown' || feedback === 'fuzzy' ? 1 : consecutiveKnown > 0 ? 7 : 3;
  return {
    nextReviewAt: addLocalCalendarDays(now, days, timeZone),
    repeatInSession: feedback === 'unknown',
  };
}

function addLocalCalendarDays(date: Date, days: number, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, Number(value)]));
  const local = new Date(Date.UTC(values.year, values.month - 1, values.day + days, values.hour, values.minute, values.second, date.getUTCMilliseconds()));
  const targetAsUtc = local.getTime();
  let candidate = targetAsUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = new Date(candidate);
    const observedParts = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(observed);
    const observedValues = Object.fromEntries(observedParts.map(({ type, value }) => [type, Number(value)]));
    const observedAsUtc = Date.UTC(observedValues.year, observedValues.month - 1, observedValues.day, observedValues.hour, observedValues.minute, observedValues.second, date.getUTCMilliseconds());
    candidate += targetAsUtc - observedAsUtc;
  }
  return new Date(candidate);
}
