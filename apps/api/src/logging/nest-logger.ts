import type { LoggerService } from '@nestjs/common';
import type { Logger } from '@repo/observability';

type Level = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * Adaptador del logger de `@repo/observability` (pino) a la interfaz de NestJS. El contexto de Nest
 * (nombre de la clase que registra) va como campo `context`; el enmascarado y los ids de petición los
 * aplica el logger de base.
 */
export class NestLogger implements LoggerService {
  constructor(private readonly logger: Logger) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('trace', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  private write(level: Level, message: unknown, optionalParams: unknown[]): void {
    // Nest añade el contexto (nombre de la clase) como último parámetro de texto.
    const last = optionalParams.at(-1);
    const context = typeof last === 'string' ? last : undefined;
    const extra = context === undefined ? optionalParams : optionalParams.slice(0, -1);
    const fields: Record<string, unknown> = context === undefined ? {} : { context };

    if (message instanceof Error) {
      this.logger[level]({ ...fields, err: message }, message.message);
      return;
    }
    if (typeof message === 'object' && message !== null) {
      // El contexto de Nest va al final: un campo `context` del objeto no lo pisa.
      this.logger[level]({ ...(message as Record<string, unknown>), ...fields });
      return;
    }
    // En `error`, Nest pasa la pila como texto antes del contexto.
    if (level === 'error' && typeof extra[0] === 'string') {
      fields['stack'] = extra[0];
    }
    this.logger[level](fields, String(message));
  }
}
