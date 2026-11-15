import { applyPomodoroEvent, effectiveSeconds, type PomodoroState } from '../src/pomodoro';
import { rescheduledTaskCopy, transitionTaskStatus, type TaskStatus } from '../src/task';

describe('pomodoro domain', () => {
  const initial: PomodoroState = { status: 'planned', accumulatedSeconds: 0, runningSince: null };
  const at = (seconds: number) => new Date(seconds * 1000);

  it('starts a planned task and transitions it to in progress', () => {
    expect(transitionTaskStatus('planned', 'start')).toBe('in_progress');
  });

  it('does not add effective time while paused', () => {
    const running = applyPomodoroEvent(initial, 'start', at(10));
    const paused = applyPomodoroEvent(running, 'pause', at(70));
    expect(effectiveSeconds(paused, at(500))).toBe(60);
  });

  it('counts only real running intervals after resume', () => {
    const firstRun = applyPomodoroEvent(initial, 'start', at(10));
    const paused = applyPomodoroEvent(firstRun, 'pause', at(70));
    const resumed = applyPomodoroEvent(paused, 'resume', at(300));
    expect(effectiveSeconds(resumed, at(330))).toBe(90);
  });

  it('does not accrue time after the task is completed', () => {
    const running = applyPomodoroEvent(initial, 'start', at(10));
    const completed = applyPomodoroEvent(running, 'complete', at(70));
    expect(completed.status).toBe('completed');
    expect(effectiveSeconds(completed, at(500))).toBe(60);
  });

  it('reschedules by creating a next-day copy with its source id', () => {
    const original = { id: 'task-1', plannedDate: '2026-11-12', status: 'planned' as TaskStatus, title: 'Review' };
    expect(rescheduledTaskCopy(original, 'task-2', '2026-11-13')).toMatchObject({
      id: 'task-2', plannedDate: '2026-11-13', sourceTaskId: 'task-1', title: 'Review', status: 'planned',
    });
  });
});
