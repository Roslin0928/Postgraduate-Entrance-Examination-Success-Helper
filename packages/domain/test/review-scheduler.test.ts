import { scheduleWordReview } from '../src/vocabulary';

describe('scheduleWordReview', () => {
  const now = new Date('2026-11-12T16:30:00.000Z');

  it('repeats unknown words in the current round and schedules them for the next local day', () => {
    const result = scheduleWordReview('unknown', now, 0, 'Asia/Shanghai');
    expect(result.repeatInSession).toBe(true);
    expect(result.nextReviewAt.toISOString()).toBe('2026-11-13T16:30:00.000Z');
  });

  it('schedules fuzzy words for the next local day', () => {
    expect(scheduleWordReview('fuzzy', now, 0, 'America/Los_Angeles').nextReviewAt.toISOString())
      .toBe('2026-11-13T16:30:00.000Z');
  });

  it('schedules a first known answer three local days later', () => {
    expect(scheduleWordReview('known', now, 0, 'UTC').nextReviewAt.toISOString())
      .toBe('2026-11-15T16:30:00.000Z');
  });

  it('schedules consecutive known answers seven local days later', () => {
    expect(scheduleWordReview('known', now, 1, 'UTC').nextReviewAt.toISOString())
      .toBe('2026-11-19T16:30:00.000Z');
  });

  it('uses the user local calendar across a timezone date boundary', () => {
    const nearMidnight = new Date('2026-11-12T23:30:00.000Z');
    expect(scheduleWordReview('fuzzy', nearMidnight, 0, 'Asia/Shanghai').nextReviewAt.toISOString())
      .toBe('2026-11-13T23:30:00.000Z');
  });
});
