import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { AccountView } from '@kaoyan/domain';
import { PrismaService } from './prisma.service';

export const WECHAT_IDENTITY_PROVIDER = Symbol('WECHAT_IDENTITY_PROVIDER');

export interface WechatIdentityProvider {
  exchangeCode(code: string): Promise<string>;
}

export interface AuthServiceContract {
  loginByWechat(code: string): Promise<{ accessToken: string; isNewUser: boolean }>;
  getCurrentUser(accessToken: string): Promise<AccountView>;
}

@Injectable()
export class AuthService implements AuthServiceContract {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WECHAT_IDENTITY_PROVIDER)
    private readonly identityProvider: WechatIdentityProvider,
  ) {}

  async loginByWechat(code: string): Promise<{ accessToken: string; isNewUser: boolean }> {
    if (!code.trim()) throw new BadRequestException('code is required');
    const wechatOpenId = await this.identityProvider.exchangeCode(code);
    const existing = await this.prisma.account.findUnique({ where: { wechatOpenId } });
    const account = existing ?? (await this.prisma.account.create({ data: { wechatOpenId } }));
    const accessToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(accessToken).digest('hex');
    await this.prisma.authSession.create({
      data: {
        accountId: account.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    return { accessToken, isNewUser: !existing };
  }

  async getCurrentUser(accessToken: string): Promise<AccountView> {
    if (!accessToken) throw new UnauthorizedException('Access token is required');
    const tokenHash = createHash('sha256').update(accessToken).digest('hex');
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash },
      include: { account: { include: { examProfile: true } } },
    });
    if (!session || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    const { account } = session;
    return {
      id: account.id,
      nickname: account.nickname,
      avatarUrl: account.avatarUrl,
      phoneBound: account.phoneBound,
      examProfile: account.examProfile
        ? {
            targetExamDate: account.examProfile.targetExamDate?.toISOString().slice(0, 10) ?? null,
            major: account.examProfile.major,
            targetSchoolId: account.examProfile.targetSchoolId,
            dailyGoalMinutes: account.examProfile.dailyGoalMinutes,
            defaultPomodoroMinutes: account.examProfile.defaultPomodoroMinutes,
          }
        : null,
    };
  }
}

export class FakeWechatIdentityProvider implements WechatIdentityProvider {
  async exchangeCode(code: string): Promise<string> {
    if (!code.trim()) throw new BadRequestException('code is required');
    return `fake-openid:${createHash('sha256').update(code).digest('hex')}`;
  }
}

export class WechatCodeIdentityProvider implements WechatIdentityProvider {
  constructor(
    private readonly appId: string = process.env.WECHAT_APP_ID ?? '',
    private readonly appSecret: string = process.env.WECHAT_APP_SECRET ?? '',
  ) {
    if (!appId || !appSecret) throw new Error('WECHAT_APP_ID and WECHAT_APP_SECRET are required');
  }

  async exchangeCode(code: string): Promise<string> {
    const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
    url.search = new URLSearchParams({
      appid: this.appId,
      secret: this.appSecret,
      js_code: code,
      grant_type: 'authorization_code',
    }).toString();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Wechat identity exchange failed (${response.status})`);
    const payload = (await response.json()) as { openid?: string; errcode?: number; errmsg?: string };
    if (!payload.openid) throw new Error(payload.errmsg ?? 'Wechat did not return an openid');
    return payload.openid;
  }
}
