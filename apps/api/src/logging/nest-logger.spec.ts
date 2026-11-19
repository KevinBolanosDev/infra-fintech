import { createLogger } from '@repo/observability';
import { describe, expect, it } from 'vitest';

import { NestLogger } from './nest-logger.js';

function setup() {
  const lines: string[] = [];
  const logger = createLogger({
    service: 'api',
    level: 'trace',
    appEnv: 'test',
    destination: { write: (line: string) => lines.push(line) },
    timestamp: () => ',"time":"1970-01-01T00:00:00.000Z"',
  });
  const entries = () => lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  return { nest: new NestLogger(logger), entries };
}

describe('NestLogger', () => {
  it.each([
    ['log', 'info'],
    ['warn', 'warn'],
    ['debug', 'debug'],
    ['verbose', 'trace'],
    ['fatal', 'fatal'],
  ] as const)('%s escribe con nivel %s y el contexto de Nest', (method, level) => {
    const { nest, entries } = setup();
    nest[method]('mensaje', 'NestApplication');
    expect(entries()).toEqual([
      expect.objectContaining({ level, msg: 'mensaje', context: 'NestApplication' }),
    ]);
  });

  it('error guarda la pila que pasa Nest y el contexto', () => {
    const { nest, entries } = setup();
    nest.error('falló', 'Error: falló\n    at x', 'ExceptionHandler');
    expect(entries()[0]).toMatchObject({
      level: 'error',
      msg: 'falló',
      stack: 'Error: falló\n    at x',
      context: 'ExceptionHandler',
    });
  });

  it('acepta un Error y lo serializa enmascarado', () => {
    const { nest, entries } = setup();
    nest.error(Object.assign(new Error('caída'), { token: 'tok_sintetico' }), 'Modulo');
    const [entry] = entries();
    expect(entry).toMatchObject({
      level: 'error',
      msg: 'caída',
      context: 'Modulo',
      err: { type: 'Error' },
    });
    expect(JSON.stringify(entry)).not.toContain('tok_sintetico');
  });

  it('acepta objetos y mensajes sin contexto', () => {
    const { nest, entries } = setup();
    nest.log({ event: 'arranque', email: 'persona@example.test', context: 'pisado' }, 'Contexto');
    nest.warn(42);
    const [object, number] = entries();
    expect(object).toMatchObject({
      level: 'info',
      event: 'arranque',
      email: '[REDACTED]',
      context: 'Contexto',
    });
    expect(number).toMatchObject({ level: 'warn', msg: '42' });
    expect(number).not.toHaveProperty('context');
  });
});
