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
import { VocabularyController } from './modules/vocabulary/vocabulary.controller';
import { VocabularyService } from './modules/vocabulary/vocabulary.service';
import { SentencesController } from './modules/sentences/sentences.controller';
import { SentencesService } from './modules/sentences/sentences.service';
import { FakeAnalysisProvider } from './modules/sentences/fake-analysis-provider';
import { HttpAnalysisProvider, SENTENCE_ANALYSIS_PROVIDER } from './modules/sentences/analysis-provider';

@Module({
  controllers: [HealthController, AuthController, MeController, ExamProfileController, TasksController, VocabularyController, SentencesController],
  providers: [
    PrismaService,
    TasksService,
    PomodoroService,
    VocabularyService,
    SentencesService,
    {
      provide: SENTENCE_ANALYSIS_PROVIDER,
      useFactory: () => {
        const configuredProvider = process.env.SENTENCE_ANALYSIS_PROVIDER;
        const provider = configuredProvider ?? (process.env.NODE_ENV === 'production' ? '' : 'fake');
        if (provider === 'http') return new HttpAnalysisProvider();
        if (provider === 'fake' && process.env.NODE_ENV !== 'production') return new FakeAnalysisProvider();
        throw new Error('Set SENTENCE_ANALYSIS_PROVIDER=http for production or fake for local development');
      },
    },
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
