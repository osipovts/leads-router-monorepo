import { Logger, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import type { AppConfigType } from './app.config';
import { appConfig } from './app.config';
import { AppModule } from './app.module';
import type { SwaggerConfigType } from './common/infrastructure/swagger.config';
import { swaggerConfig } from './common/infrastructure/swagger.config';
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

  // Swagger
  const swagger = app.get<SwaggerConfigType>(swaggerConfig.KEY);
  if (swagger.isEnabled) {
    const swaggerBuilder = new DocumentBuilder().setVersion('1.0').build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerBuilder);
    SwaggerModule.setup(swagger.apiDocs, app, swaggerDocument, {
      jsonDocumentUrl: swagger.apiJsonDocs,
    });
  }

  // Start
  const { host, port } = app.get<AppConfigType>(appConfig.KEY);
  await app.listen(port, host);

  // Post-start logs
  const appUrl = await app.getUrl();
  Logger.log(`Application is listening on ${appUrl}`, 'Bootstrap');
  if (swagger.isEnabled) {
    Logger.log(`Swagger documentation: ${appUrl}/${swagger.apiDocs}`, 'Bootstrap');
  }
}

bootstrap().catch((e: unknown): void => {
  Logger.error(e);
});
