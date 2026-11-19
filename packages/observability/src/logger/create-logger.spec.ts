import { setTimeout as sleep } from 'node:timers/promises';

import type { DestinationStream } from 'pino';
import { describe, expect, it } from 'vitest';

import { ExecutionContext } from '../context/execution-context.js';
import {
  buildLoggerOptions,
  createLogger,
  type CreateLoggerOptions,
  prettyTransport,
} from './create-logger.js';

/** Destino en memoria: cada `write` de pino es una línea JSON. */
function memoryDestination(): DestinationStream & { readonly lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    write(chunk: string) {
      lines.push(chunk);
    },
  };
}

const FIXED_TIME = ',"time":"2026-01-01T00:00:00.000Z"';

function testLogger(overrides: Partial<CreateLoggerOptions> = {}) {
  const destination = memoryDestination();
  const context = new ExecutionContext();
  const logger = createLogger({
    service: 'api',
    level: 'info',
    appEnv: 'test',
    destination,
    context,
    timestamp: () => FIXED_TIME,
    ...overrides,
  });
  const entries = (): Record<string, unknown>[] =>
    destination.lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  return { logger, context, destination, entries };
}

// Datos sintéticos, nunca reales.
const SENSITIVE_VALUES = [
  'persona@example.test',
  '+57 300 000 0000',
  '1000000000',
  'secreto-sintetico',
  'Bearer token-sintetico',
  'sid=cookie-sintetica',
  'tok_sintetico',
];

describe('createLogger', () => {
  it('escribe JSON con servicio, ambiente, nivel en texto y la hora inyectada', () => {
    const { logger, entries } = testLogger();
    logger.info({ chargeId: 'c-1' }, 'cobro creado');

    expect(entries()).toEqual([
      {
        level: 'info',
        time: '2026-01-01T00:00:00.000Z',
        service: 'api',
        app_env: 'test',
        chargeId: 'c-1',
        msg: 'cobro creado',
      },
    ]);
  });

  it('ningún valor sensible aparece en la salida serializada (anidados, arreglos, cabeceras, hijos)', () => {
    const { logger, destination } = testLogger();
    logger.info(
      {
        user: { email: 'persona@example.test', phone: '+57 300 000 0000' },
        tenants: [{ documento: '1000000000' }, { contacts: [{ password: 'secreto-sintetico' }] }],
        req: {
          headers: { authorization: 'Bearer token-sintetico', cookie: 'sid=cookie-sintetica' },
        },
      },
      'petición recibida',
    );
    logger
      .child({ accessToken: 'tok_sintetico' })
      .warn({ nested: [{ email: 'persona@example.test' }] }, 'hijo');

    const output = destination.lines.join('');
    for (const value of SENSITIVE_VALUES) {
      expect(output).not.toContain(value);
    }
    expect(output).toContain('[REDACTED]');
  });

  it('enmascara errores: propiedades propias, cabeceras de configuración y cause', () => {
    const { logger, destination, entries } = testLogger();
    class ProviderError extends Error {
      override name = 'ProviderError';
      constructor(
        message: string,
        readonly config: Record<string, unknown>,
        options?: ErrorOptions,
      ) {
        super(message, options);
      }
    }
    const cause = Object.assign(new Error('falló la consulta'), {
      meta: { target: ['email'], email: 'persona@example.test' },
    });
    const error = new ProviderError(
      'proveedor rechazó la petición',
      { headers: { Authorization: 'Bearer token-sintetico' }, data: { documento: '1000000000' } },
      { cause },
    );

    logger.error(error);
    logger.warn({ err: error, attempt: 2 }, 'reintento');

    const output = destination.lines.join('');
    for (const value of ['Bearer token-sintetico', '1000000000', 'persona@example.test']) {
      expect(output).not.toContain(value);
    }
    const [first, second] = entries();
    expect(first).toMatchObject({
      msg: 'proveedor rechazó la petición',
      err: { type: 'ProviderError', message: 'proveedor rechazó la petición' },
    });
    expect(second).toMatchObject({ attempt: 2, err: { type: 'ProviderError' } });
    expect(JSON.stringify(first)).toContain('falló la consulta');
  });

  it('enmascara instancias de clases (DTOs, entidades)', () => {
    const { logger, destination } = testLogger();
    class TenantDto {
      constructor(
        readonly name: string,
        readonly email: string,
        readonly documento: string,
      ) {}
    }
    logger.info(
      { tenant: new TenantDto('Inquilina', 'persona@example.test', '1000000000') },
      'dto',
    );

    const output = destination.lines.join('');
    expect(output).not.toMatch(/persona@example\.test|1000000000/);
    expect(output).toContain('"name":"Inquilina"');
  });

  it('enmascara los bindings de hijos y nietos, y conserva los del padre', () => {
    const { logger, destination, entries } = testLogger();
    logger
      .child({ module: 'charges', email: 'persona@example.test' })
      .child({ accessToken: 'tok_sintetico', step: 'cobro' })
      .info('nieto');

    expect(destination.lines.join('')).not.toMatch(/persona@example\.test|tok_sintetico/);
    expect(entries()[0]).toMatchObject({
      module: 'charges',
      email: '[REDACTED]',
      accessToken: '[REDACTED]',
      step: 'cobro',
      msg: 'nieto',
    });
  });

  it('agrega request_id y correlation_id en cada línea dentro de un contexto, y no fuera', () => {
    const { logger, context, entries } = testLogger();
    logger.info('fuera');
    context.run(
      {
        requestId: 'req-1',
        correlationId: 'corr-1',
        ip: '10.0.0.1',
        userAgent: 'agente-sintetico/1.0',
      },
      () => {
        logger.info('dentro 1');
        logger.child({ module: 'charges' }).info('dentro 2');
      },
    );

    const [outside, inside1, inside2] = entries();
    expect(outside).not.toHaveProperty('request_id');
    for (const entry of [inside1, inside2]) {
      expect(entry).toMatchObject({ request_id: 'req-1', correlation_id: 'corr-1' });
      expect(entry).not.toHaveProperty('ip');
      expect(entry).not.toHaveProperty('userAgent');
      expect(JSON.stringify(entry)).not.toContain('agente-sintetico');
    }
  });

  it('no mezcla request_id entre ejecuciones concurrentes', async () => {
    const { logger, context, entries } = testLogger();
    const work = (requestId: string, delays: number[]): Promise<void> =>
      context.run({ requestId, correlationId: `corr-${requestId}` }, async () => {
        for (const [step, delay] of delays.entries()) {
          await sleep(delay);
          logger.info({ owner: requestId, step }, 'paso');
        }
      });

    await Promise.all([work('req-a', [5, 1, 5]), work('req-b', [1, 5, 1])]);

    const lines = entries();
    expect(lines).toHaveLength(6);
    for (const line of lines) {
      expect(line['request_id']).toBe(line['owner']);
      expect(line['correlation_id']).toBe(`corr-${String(line['owner'])}`);
    }
  });

  it('respeta el nivel configurado', () => {
    const { logger, entries } = testLogger({ level: 'warn' });
    logger.info('se descarta');
    logger.error('se escribe');
    expect(entries().map((entry) => entry['msg'])).toEqual(['se escribe']);
  });

  it('usa la hora real en ISO si no se inyecta otra', () => {
    const destination = memoryDestination();
    createLogger({ service: 'worker', level: 'info', appEnv: 'test', destination }).info('hora');
    const entry = JSON.parse(destination.lines[0] ?? '{}') as { time?: string };
    expect(entry.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('usa el contexto del proceso por defecto', () => {
    const options = buildLoggerOptions({ service: 'api', level: 'info', appEnv: 'test' });
    expect(options.mixin?.({}, 30, undefined as never)).toEqual({});
  });
});

describe('prettyTransport', () => {
  it('usa pino-pretty solo en local', () => {
    expect(prettyTransport('local')).toMatchObject({ target: 'pino-pretty' });
    for (const appEnv of ['test', 'staging', 'sandbox', 'production'] as const) {
      expect(prettyTransport(appEnv)).toBeUndefined();
    }
  });

  it('crea el logger sin destino explícito (stdout en producción, pino-pretty en local)', () => {
    expect(createLogger({ service: 'api', level: 'silent', appEnv: 'production' }).level).toBe(
      'silent',
    );
    expect(createLogger({ service: 'api', level: 'silent', appEnv: 'local' }).level).toBe('silent');
  });
});
