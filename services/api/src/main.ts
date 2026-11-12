import 'reflect-metadata';
import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  dotenv.config({ path: resolve(process.cwd(), '../../.env') });
  const app = await NestFactory.create(AppModule);
  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
