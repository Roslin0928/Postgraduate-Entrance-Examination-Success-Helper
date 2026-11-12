export type TaskType = 'custom' | 'vocabulary' | 'sentence' | 'school_search';
export type TaskStatus = 'planned' | 'in_progress' | 'completed' | 'skipped' | 'rescheduled';
export type TaskAction = 'start' | 'pause' | 'complete' | 'skip' | 'reschedule';

export interface CreateTaskInput {
  title: string;
  type: TaskType;
  plannedMinutes: number;
  plannedDate: string;
  priority: number;
}

export interface TaskSummary {
  id: string;
  title: string;
  type: TaskType;
  plannedMinutes: number;
  plannedDate: string;
  priority: number;
  status: TaskStatus;
  completedMinutes: number;
  sourceTaskId: string | null;
}

export function transitionTaskStatus(status: TaskStatus, action: TaskAction): TaskStatus {
  if (action === 'start' && (status === 'planned' || status === 'in_progress')) return 'in_progress';
  if (action === 'pause' && status === 'in_progress') return 'planned';
  if (action === 'complete' && status !== 'completed' && status !== 'skipped') return 'completed';
  if (action === 'skip' && status !== 'completed' && status !== 'skipped') return 'skipped';
  if (action === 'reschedule' && status !== 'completed' && status !== 'skipped') return 'planned';
  throw new Error(`Cannot ${action} a task in ${status} status`);
}

export function rescheduledTaskCopy<T extends { id: string; plannedDate: string; sourceTaskId?: string | null }>(
  task: T,
  copyId: string,
  nextDate: string,
): T & { id: string; plannedDate: string; status: 'planned'; sourceTaskId: string } {
  return { ...task, id: copyId, plannedDate: nextDate, status: 'planned', sourceTaskId: task.id };
}
