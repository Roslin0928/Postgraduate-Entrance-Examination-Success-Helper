export type PomodoroStatus = 'running' | 'paused' | 'completed';
export type PomodoroEventAction = 'start' | 'pause' | 'resume' | 'complete' | 'sync';

export interface PomodoroState {
  status: 'planned' | PomodoroStatus;
  accumulatedSeconds: number;
  runningSince: Date | null;
}

export function applyPomodoroEvent(
  state: PomodoroState,
  action: PomodoroEventAction,
  at: Date,
): PomodoroState {
  if (action === 'start' && state.status === 'planned') {
    return { ...state, status: 'running', runningSince: at };
  }
  if (action === 'pause' && state.status === 'running' && state.runningSince) {
    return {
      status: 'paused',
      accumulatedSeconds: state.accumulatedSeconds + elapsed(state.runningSince, at),
      runningSince: null,
    };
  }
  if (action === 'resume' && state.status === 'paused') {
    return { ...state, status: 'running', runningSince: at };
  }
  if (action === 'complete' && (state.status === 'running' || state.status === 'paused')) {
    return {
      status: 'completed',
      accumulatedSeconds: state.accumulatedSeconds + (state.runningSince ? elapsed(state.runningSince, at) : 0),
      runningSince: null,
    };
  }
  throw new Error(`Cannot ${action} a pomodoro session in ${state.status} status`);
}

export function effectiveSeconds(state: PomodoroState, now = new Date()): number {
  return state.accumulatedSeconds + (state.status === 'running' && state.runningSince ? elapsed(state.runningSince, now) : 0);
}

function elapsed(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 1000));
}
