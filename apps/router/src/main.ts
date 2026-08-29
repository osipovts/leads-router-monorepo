import { Logger, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import type { AppConfigType } from './app.config';
import { appConfig } from './app.config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // API version
  app.enableVersioning({ type: VersioningType.URI });
  app.setGlobalPrefix('api');

  // Global stuff

  const config = app.get<AppConfigType>(appConfig.KEY);

  // Start
  await app.listen(config.port, config.host);
}

bootstrap().catch((e: unknown): void => {
  Logger.error(e);
});
