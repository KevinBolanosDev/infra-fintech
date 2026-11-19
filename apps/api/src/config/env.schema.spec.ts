import { describe, expect, it } from 'vitest';

import { EnvValidationError, parseEnv } from './env.schema.js';

describe('parseEnv', () => {
  it('aplica los valores por defecto con solo APP_ENV', () => {
    expect(parseEnv({ APP_ENV: 'local' })).toEqual({
      APP_ENV: 'local',
      HTTP_PORT: 3000,
      ALLOWED_ORIGINS: [],
      LOG_LEVEL: 'info',
      TRUST_PROXY: false,
      HTTP_BODY_LIMIT: '100kb',
    });
  });

  it('interpreta puertos, orígenes, nivel, proxies y límite de cuerpo', () => {
    expect(
      parseEnv({
        APP_ENV: 'staging',
        HTTP_PORT: '8080',
        ALLOWED_ORIGINS: 'https://app.example.test, http://localhost:3001',
        LOG_LEVEL: 'debug',
        TRUST_PROXY: '2',
        HTTP_BODY_LIMIT: '1mb',
      }),
    ).toEqual({
      APP_ENV: 'staging',
      HTTP_PORT: 8080,
      ALLOWED_ORIGINS: ['https://app.example.test', 'http://localhost:3001'],
      LOG_LEVEL: 'debug',
      TRUST_PROXY: 2,
      HTTP_BODY_LIMIT: '1mb',
    });
  });

  it.each([
    [{}, 'APP_ENV (falta)'],
    [{ APP_ENV: 'produccion' }, 'APP_ENV'],
    [{ APP_ENV: 'local', HTTP_PORT: '70000' }, 'HTTP_PORT'],
    [{ APP_ENV: 'local', HTTP_PORT: 'abc' }, 'HTTP_PORT'],
    [{ APP_ENV: 'local', HTTP_PORT: '' }, 'HTTP_PORT'],
    [{ APP_ENV: 'production', HTTP_PORT: '0' }, 'HTTP_PORT (el puerto 0'],
    [{ APP_ENV: 'local', ALLOWED_ORIGINS: '*' }, 'ALLOWED_ORIGINS'],
    [{ APP_ENV: 'local', ALLOWED_ORIGINS: 'https://app.example.test/ruta' }, 'ALLOWED_ORIGINS'],
    [{ APP_ENV: 'local', LOG_LEVEL: 'verbose' }, 'LOG_LEVEL'],
    [{ APP_ENV: 'local', TRUST_PROXY: 'true' }, 'TRUST_PROXY'],
    [{ APP_ENV: 'local', TRUST_PROXY: '0' }, 'TRUST_PROXY'],
    [{ APP_ENV: 'local', HTTP_BODY_LIMIT: '10gb' }, 'HTTP_BODY_LIMIT'],
  ])('rechaza %o nombrando la variable', (env, expected) => {
    expect(() => parseEnv(env)).toThrow(EnvValidationError);
    expect(() => parseEnv(env)).toThrow(expected);
  });

  it('permite el puerto 0 en local y test', () => {
    expect(parseEnv({ APP_ENV: 'test', HTTP_PORT: '0' }).HTTP_PORT).toBe(0);
    expect(parseEnv({ APP_ENV: 'local', HTTP_PORT: '0' }).HTTP_PORT).toBe(0);
  });

  it('el mensaje nombra las variables pero nunca muestra sus valores', () => {
    const secretLooking = 'valor-sintetico-que-no-debe-aparecer';
    try {
      parseEnv({ APP_ENV: secretLooking, HTTP_PORT: secretLooking });
      expect.unreachable('debía lanzar');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const { message, problems } = error as EnvValidationError;
      expect(message).toContain('APP_ENV');
      expect(message).toContain('HTTP_PORT');
      expect(message).not.toContain(secretLooking);
      expect(problems).toHaveLength(2);
    }
  });
});
