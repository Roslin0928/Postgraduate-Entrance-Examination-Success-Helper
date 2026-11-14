import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  UnauthorizedException,
} from '@nestjs/common';
import { EXAM_PROFILE_PATCH_FIELDS, type ExamProfilePatch } from '@kaoyan/domain';
import { PrismaService } from './prisma.service';
import { AuthService } from './auth.service';

@Controller('v1/exam-profile')
export class ExamProfileController {
  constructor(private readonly authService: AuthService, private readonly prisma: PrismaService) {}

  private async accountId(authorization?: string): Promise<string> {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) throw new UnauthorizedException('Bearer token is required');
    return (await this.authService.getCurrentUser(token)).id;
  }

  @Get()
  async getProfile(@Headers('authorization') authorization?: string) {
    const accountId = await this.accountId(authorization);
    const profile = await this.prisma.examProfile.findUnique({ where: { accountId } });
    return this.toView(profile);
  }

  @Patch()
  async patchProfile(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const accountId = await this.accountId(authorization);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Body must be an object');
    }
    const input = body as Record<string, unknown>;
    const allowed = new Set<string>(EXAM_PROFILE_PATCH_FIELDS);
    const unknown = Object.keys(input).filter((key) => !allowed.has(key));
    if (unknown.length) throw new BadRequestException(`Unsupported fields: ${unknown.join(', ')}`);
    const patch: ExamProfilePatch = {};
    for (const field of EXAM_PROFILE_PATCH_FIELDS) {
      if (!(field in input)) continue;
      const value = input[field];
      if (field === 'targetExamDate' || field === 'major' || field === 'targetSchoolId') {
        if (value !== null && typeof value !== 'string') {
          throw new BadRequestException(`${field} must be a string or null`);
        }
        if (field === 'targetExamDate' && typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          throw new BadRequestException('targetExamDate must use YYYY-MM-DD');
        }
        Object.assign(patch, { [field]: value });
      } else if (field === 'availableWindows') {
        if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
          throw new BadRequestException('availableWindows must be an array of strings');
        }
        Object.assign(patch, { availableWindows: value });
      } else {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 1440) {
          throw new BadRequestException(`${field} must be an integer from 1 to 1440`);
        }
        Object.assign(patch, { [field]: value });
      }
    }
    const data: Record<string, unknown> = { ...patch };
    if (typeof patch.targetExamDate === 'string') data.targetExamDate = new Date(`${patch.targetExamDate}T00:00:00.000Z`);
    if (patch.availableWindows) data.availableWindows = JSON.stringify(patch.availableWindows);
    const profile = await this.prisma.examProfile.upsert({
      where: { accountId },
      create: { accountId, ...data },
      update: data,
    });
    return this.toView(profile);
  }

  private toView(profile: any) {
    if (!profile) return null;
    return {
      targetExamDate: profile.targetExamDate?.toISOString().slice(0, 10) ?? null,
      major: profile.major,
      targetSchoolId: profile.targetSchoolId,
      availableWindows: JSON.parse(profile.availableWindows || '[]'),
      dailyGoalMinutes: profile.dailyGoalMinutes,
      defaultPomodoroMinutes: profile.defaultPomodoroMinutes,
    };
  }
}
