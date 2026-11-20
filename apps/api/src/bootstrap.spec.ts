import 'reflect-metadata';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  NEST_TEST_TIMEOUT_MS,
  NEST_WARMUP_TIMEOUT_MS,
  warmUpNest,
} from '../test/support/nest-test-timeouts.js';
import { bootstrap } from './bootstrap.js';

beforeAll(warmUpNest, NEST_WARMUP_TIMEOUT_MS);

describe('bootstrap', { timeout: NEST_TEST_TIMEOUT_MS }, () => {
  it('con un entorno inválido escribe un mensaje claro sin valores y deja el código de salida en 1', async () => {
    const writeError = vi.fn<(message: string) => void>();
    const setExitCode = vi.fn<(code: number) => void>();

    const result = await bootstrap({
      env: { APP_ENV: 'valor-sintetico-invalido' },
      writeError,
      setExitCode,
    });

    expect(result).toBeUndefined();
    expect(setExitCode).toHaveBeenCalledWith(1);
    const message = writeError.mock.calls[0]?.[0] ?? '';
    expect(message).toContain(
      'No se pudo arrancar la API. Variables de entorno inválidas: APP_ENV',
    );
    expect(message).not.toContain('valor-sintetico-invalido');
  });

  it('con un entorno válido escucha en el puerto indicado y se puede cerrar', async () => {
    const result = await bootstrap({
      env: { APP_ENV: 'test', HTTP_PORT: '0', LOG_LEVEL: 'silent' },
    });

    expect(result).toBeDefined();
    const address = result?.app.getHttpServer().address() as { port: number } | null;
    expect(address?.port).toBeGreaterThan(0);
    await result?.app.close();
  });

  it('informa otros errores de arranque sin lanzar', async () => {
    const writeError = vi.fn<(message: string) => void>();
    const setExitCode = vi.fn<(code: number) => void>();
    const first = await bootstrap({
      env: { APP_ENV: 'test', HTTP_PORT: '0', LOG_LEVEL: 'silent' },
    });
    const address = first?.app.getHttpServer().address() as { port: number } | null;

    // Mismo puerto ocupado: falla `listen`, no la validación.
    const second = await bootstrap({
      env: { APP_ENV: 'test', HTTP_PORT: String(address?.port), LOG_LEVEL: 'silent' },
      writeError,
      setExitCode,
    });

    expect(second).toBeUndefined();
    expect(setExitCode).toHaveBeenCalledWith(1);
    expect(writeError.mock.calls[0]?.[0]).toMatch(/^No se pudo arrancar la API: /);
    await first?.app.close();
  });
});
