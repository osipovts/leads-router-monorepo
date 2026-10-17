import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // Воркер не обслуживает HTTP, поэтому контекст приложения вместо express-сервера
  const app = await NestFactory.createApplicationContext(AppModule);

  // Graceful shutdown on SIGTERM/SIGINT: дорабатываем джобу, закрываем Redis и Prisma
  app.enableShutdownHooks();

  Logger.log('Router worker started', 'Bootstrap');
}

bootstrap().catch((e: unknown): void => {
  Logger.error(e);
  process.exit(1);
});
