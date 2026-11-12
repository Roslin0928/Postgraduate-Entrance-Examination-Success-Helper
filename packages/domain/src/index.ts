export interface ExamProfileView {
  targetExamDate: string | null;
  major: string | null;
  targetSchoolId: string | null;
  dailyGoalMinutes: number;
  defaultPomodoroMinutes: number;
}

export interface AccountView {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
  phoneBound: boolean;
  examProfile: ExamProfileView | null;
}

export const EXAM_PROFILE_PATCH_FIELDS = [
  'targetExamDate',
  'major',
  'targetSchoolId',
  'availableWindows',
  'dailyGoalMinutes',
  'defaultPomodoroMinutes',
] as const;

export type ExamProfilePatch = Partial<{
  targetExamDate: string | null;
  major: string | null;
  targetSchoolId: string | null;
  availableWindows: string[];
  dailyGoalMinutes: number;
  defaultPomodoroMinutes: number;
}>;

export * from './task';
export * from './pomodoro';
