import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // Обработчик очереди запускается без HTTP-сервера.
  const app = await NestFactory.createApplicationContext(AppModule);

  // При SIGTERM/SIGINT приложение завершает обработку задач и закрывает соединения.
  app.enableShutdownHooks();

  Logger.log('Router worker started', 'Bootstrap');
}

bootstrap().catch((e: unknown): void => {
  Logger.error(e);
  process.exit(1);
});
