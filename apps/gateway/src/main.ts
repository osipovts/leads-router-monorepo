import { Logger, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import type { AppConfigType } from './app.config';
import { appConfig } from './app.config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/presentation/http/http-exception.filter';
import { HttpLoggingInterceptor } from './common/presentation/http/http-logging.interceptor';
import { HttpValidationPipe } from './common/presentation/http/http-validation.pipe';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // API version
  app.enableVersioning({ type: VersioningType.URI });
  app.setGlobalPrefix('api');

  // Global stuff
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new HttpLoggingInterceptor());
  app.useGlobalPipes(new HttpValidationPipe());

  const config = app.get<AppConfigType>(appConfig.KEY);

  // Swagger
  if (config.swagger.isEnabled) {
    const swaggerConfig = new DocumentBuilder().setVersion('1.0').build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(config.swagger.apiDocs, app, swaggerDocument, {
      jsonDocumentUrl: config.swagger.apiJsonDocs,
    });
  }

  // Start
  await app.listen(config.port, config.host);

  // Post-start logs
  const log = (msg: string): void => {
    Logger.log(msg, 'Bootstrap');
  };
  const appUrl = await app.getUrl();
  log(`Application is listening on ${appUrl}`);
  if (config.swagger.isEnabled) {
    log(`Swagger documentation: ${appUrl}/${config.swagger.apiDocs}`);
  }
}

bootstrap().catch((e: unknown): void => {
  Logger.error(e);
});
