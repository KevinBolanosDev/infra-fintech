import { type DestinationStream, type Logger, type LoggerOptions, pino } from 'pino';

import { type ExecutionContext, executionContext } from '../context/execution-context.js';
import { redact } from './redaction.js';

/** Ambientes del plan (variable `APP_ENV`). */
export const APP_ENVS = ['local', 'test', 'staging', 'sandbox', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface CreateLoggerOptions {
  /** Nombre del servicio (`api`, `worker`, `provider-sim`); va en cada línea. */
  readonly service: string;
  readonly level: LogLevel;
  readonly appEnv: AppEnv;
  /** Destino de la salida (pruebas). Sin él: stdout, o `pino-pretty` en `local`. */
  readonly destination?: DestinationStream;
  /** Contexto del que salen `request_id` y `correlation_id`. Por defecto, el del proceso. */
  readonly context?: ExecutionContext;
  /**
   * Fragmento de marca de tiempo (formato de pino: `,"time":"…"`). Por defecto la hora real en ISO:
   * la hora de un log es operativa (cuándo ocurrió de verdad), no de negocio, así que no pasa por el
   * reloj simulado de `ClockService`.
   */
  readonly timestamp?: () => string;
}

/** Opciones de pino del logger del monorepo (sin destino ni transporte). */
export function buildLoggerOptions(options: CreateLoggerOptions): LoggerOptions {
  const context = options.context ?? executionContext;

  return {
    level: options.level,
    base: { service: options.service, app_env: options.appEnv },
    timestamp: options.timestamp ?? pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => redact(bindings),
      // También convierte los errores (con sus propiedades propias y `cause`) y los enmascara.
      log: (object) => redact(object),
    },
    // pino aplica los serializadores después de `formatters.log`: el de errores por defecto
    // reprocesaría el objeto ya enmascarado (perdiendo `type` y mezclando mensajes de `cause`).
    serializers: { err: (value: unknown) => value },
    mixin: () => {
      const store = context.get();
      return store === undefined
        ? {}
        : { request_id: store.requestId, correlation_id: store.correlationId };
    },
  };
}

/** `pino-pretty` solo en `local`; en el resto de ambientes, JSON por stdout. */
export function prettyTransport(appEnv: AppEnv): LoggerOptions['transport'] {
  return appEnv === 'local'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
    : undefined;
}

type ChildMethod = (this: Logger, ...args: Parameters<Logger['child']>) => Logger;

/**
 * pino no aplica `formatters.bindings` a los hijos (lo reemplaza por una identidad en `child()`), así
 * que se enmascaran los bindings antes de delegar. Los hijos se crean con `Object.create(padre)` y
 * heredan este `child`, de modo que también cubre a los nietos.
 */
function redactChildBindings(logger: Logger): Logger {
  const originalChild = Reflect.get(
    Object.getPrototypeOf(logger) as object,
    'child',
  ) as ChildMethod;
  const child: ChildMethod = function (this: Logger, bindings, childOptions) {
    return originalChild.call(this, redact(bindings), childOptions);
  };
  Object.defineProperty(logger, 'child', { value: child, writable: true, configurable: true });
  return logger;
}

/**
 * Logger JSON del monorepo: una línea por evento con `service`, `app_env`, `level` (texto), hora ISO
 * y, dentro de un contexto de ejecución, `request_id` y `correlation_id`. Los valores de claves
 * sensibles se enmascaran a cualquier profundidad (ver `redaction.ts`), también en los bindings de
 * los loggers hijos.
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  const loggerOptions = buildLoggerOptions(options);
  const logger =
    options.destination === undefined
      ? pino({ ...loggerOptions, transport: prettyTransport(options.appEnv) })
      : pino(loggerOptions, options.destination);
  return redactChildBindings(logger);
}
