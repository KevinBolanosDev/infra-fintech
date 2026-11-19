import { type Type, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createLogger, type CreateLoggerOptions, type Logger } from '@repo/observability';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/http/all-exceptions.filter.js';
import { ProblemResponder } from './common/http/problem-responder.js';
import {
  CORRELATION_ID_HEADER,
  createRequestContextMiddleware,
  REQUEST_ID_HEADER,
} from './common/http/request-context.middleware.js';
import { ZodValidationPipe } from './common/validation/zod-validation.pipe.js';
import { type AppConfig, parseEnv } from './config/env.schema.js';
import { NestLogger } from './logging/nest-logger.js';

/** Hora fija de los logs en `APP_ENV=test` (ADR-0006): salidas deterministas. */
export const TEST_LOG_TIMESTAMP = ',"time":"1970-01-01T00:00:00.000Z"';

export interface CreateAppOptions {
  /**
   * Módulos adicionales, **solo para pruebas** (por ejemplo, un controlador que lanza errores).
   * `bootstrap()` nunca los pasa, así que no llegan a producción.
   */
  readonly extraModules?: readonly Type[];
  /** Destino de los logs (pruebas). Por defecto, stdout. */
  readonly logDestination?: CreateLoggerOptions['destination'];
}

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
  options: CreateAppOptions = {},
): Promise<CreatedApp> {
  const config = parseEnv(env);
  if ((options.extraModules?.length ?? 0) > 0 && config.APP_ENV !== 'test') {
    // Red de seguridad: los módulos solo de pruebas nunca se cargan fuera de APP_ENV=test.
    throw new Error('extraModules solo se permite con APP_ENV=test');
  }
  const logger = createLogger({
    service: 'api',
    level: config.LOG_LEVEL,
    appEnv: config.APP_ENV,
    ...(config.APP_ENV === 'test' ? { timestamp: () => TEST_LOG_TIMESTAMP } : {}),
    ...(options.logDestination === undefined ? {} : { destination: options.logDestination }),
  });
  const responder = new ProblemResponder(logger);

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(config, options.extraModules),
    {
      logger: new NestLogger(logger),
      // El cuerpo se limita abajo con `useBodyParser`; los errores de arranque se lanzan (no `process.exit`).
      bodyParser: false,
      abortOnError: false,
    },
  );

  // Orden de los middlewares de Express (importa):
  // 1. helmet: toda respuesta, incluidas las de error, lleva las cabeceras de seguridad.
  app.use(helmet());
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY);
  // 2. Contexto de la petición (request_id, correlation_id, IP, agente): todo lo que sigue lo ve.
  app.use(createRequestContextMiddleware());
  // 3. CORS antes del cuerpo: también las respuestas de error llevan sus cabeceras.
  //    Lista blanca explícita; nunca `*`. Sin orígenes configurados no se acepta ninguno cruzado.
  app.enableCors({
    origin: [...config.ALLOWED_ORIGINS],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      REQUEST_ID_HEADER,
      CORRELATION_ID_HEADER,
    ],
    exposedHeaders: [REQUEST_ID_HEADER],
  });
  // 4. Cuerpo con límite, y sus errores (JSON mal formado, demasiado grande) como problem+json.
  app.useBodyParser('json', { limit: config.HTTP_BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: config.HTTP_BODY_LIMIT, extended: false });
  app.use(responder.expressErrorHandler);

  // Errores de Nest (rutas, validación, dominio, inesperados) como problem+json (D-11, ADR-0008).
  app.useGlobalFilters(new AllExceptionsFilter(responder));
  app.useGlobalPipes(new ZodValidationPipe());

  // Rutas de negocio en /v1/...; /health es neutral a la versión.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  return { app, config, logger };
}
