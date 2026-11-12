import type { AccountView, ExamProfileView } from '../src';

describe('domain view types', () => {
  it('supports a new account without an exam profile or bound phone', () => {
    const account: AccountView = {
      id: 'account-1',
      nickname: null,
      avatarUrl: null,
      phoneBound: false,
      examProfile: null,
    };

    expect(account.examProfile).toBeNull();
  });

  it('allows a profile without a target school or exam date', () => {
    const profile: ExamProfileView = {
      targetExamDate: null,
      major: 'Computer Science',
      targetSchoolId: null,
      dailyGoalMinutes: 180,
      defaultPomodoroMinutes: 25,
    };

    expect(profile.targetSchoolId).toBeNull();
    expect(profile.targetExamDate).toBeNull();
  });
});
