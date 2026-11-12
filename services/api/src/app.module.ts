import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import {
  AuthService,
  FakeWechatIdentityProvider,
  WECHAT_IDENTITY_PROVIDER,
  WechatCodeIdentityProvider,
} from './auth.service';
import { ExamProfileController } from './exam-profile.controller';
import { HealthController } from './health.controller';
import { MeController } from './me.controller';
import { PrismaService } from './prisma.service';
import { TasksController } from './modules/tasks/tasks.controller';
import { TasksService } from './modules/tasks/tasks.service';
import { PomodoroService } from './modules/tasks/pomodoro.service';

@Module({
  controllers: [HealthController, AuthController, MeController, ExamProfileController, TasksController],
  providers: [
    PrismaService,
    TasksService,
    PomodoroService,
    AuthService,
    {
      provide: WECHAT_IDENTITY_PROVIDER,
      useFactory: () => {
        const configuredProvider = process.env.WECHAT_PROVIDER;
        const provider = configuredProvider ?? (process.env.NODE_ENV === 'production' ? '' : 'fake');
        if (provider === 'wechat') return new WechatCodeIdentityProvider();
        if (provider === 'fake' && process.env.NODE_ENV !== 'production') {
          return new FakeWechatIdentityProvider();
        }
        throw new Error('Set WECHAT_PROVIDER=wechat for production or fake for local development');
      },
    },
  ],
})
export class AppModule {}
