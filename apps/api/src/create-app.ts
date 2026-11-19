import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createLogger, type Logger } from '@repo/observability';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { type AppConfig, parseEnv } from './config/env.schema.js';
import { NestLogger } from './logging/nest-logger.js';

/** Hora fija de los logs en `APP_ENV=test` (ADR-0006): salidas deterministas. */
export const TEST_LOG_TIMESTAMP = ',"time":"1970-01-01T00:00:00.000Z"';

export interface CreatedApp {
  readonly app: NestExpressApplication;
  readonly config: AppConfig;
  readonly logger: Logger;
}

/**
 * Crea y configura la API sin escuchar en ningún puerto (las pruebas usan Supertest sobre `app`).
 * Lanza `EnvValidationError` si el entorno no es válido.
 */
export async function createApp(
  env: Readonly<Record<string, string | undefined>>,
): Promise<CreatedApp> {
  const config = parseEnv(env);
  const logger = createLogger({
    service: 'api',
    level: config.LOG_LEVEL,
    appEnv: config.APP_ENV,
    ...(config.APP_ENV === 'test' ? { timestamp: () => TEST_LOG_TIMESTAMP } : {}),
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(config), {
    logger: new NestLogger(logger),
    // El cuerpo se limita abajo con `useBodyParser`; los errores de arranque se lanzan (no `process.exit`).
    bodyParser: false,
    abortOnError: false,
  });

  // Helmet primero: toda respuesta, incluidas las de error, lleva las cabeceras de seguridad.
  app.use(helmet());
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY);
  app.useBodyParser('json', { limit: config.HTTP_BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: config.HTTP_BODY_LIMIT, extended: false });

  // Lista blanca explícita; nunca `*`. Sin orígenes configurados no se acepta ninguno cruzado.
  app.enableCors({
    origin: [...config.ALLOWED_ORIGINS],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
  });

  // Rutas de negocio en /v1/...; /health es neutral a la versión.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  return { app, config, logger };
}
