import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import type { AppConfigType } from './app.config';
import { appConfig } from './app.config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const config = app.get<AppConfigType>(appConfig.KEY);

  await app.listen(config.port, config.host);
}

bootstrap().catch((e: unknown): void => {
  Logger.error(e);
});
