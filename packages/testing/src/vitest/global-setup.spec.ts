import { describe, expect, it, vi } from 'vitest';

import type { StartedPostgres } from '../containers/postgres.js';
import type { StartedRedis } from '../containers/redis.js';
import { enforceContainerPolicy, type GlobalSetupDeps, setup } from './global-setup.js';

const OWNER = 'postgresql://fintech_owner:test-owner@127.0.0.1:1/fintech';
const APP = 'postgresql://fintech_app:test-app@127.0.0.1:1/fintech';
const REDIS = 'redis://127.0.0.1:2';

function fakes(overrides: Partial<GlobalSetupDeps> = {}) {
  const stopPostgres = vi.fn(() => Promise.resolve());
  const stopRedis = vi.fn(() => Promise.resolve());
  const postgres = {
    container: { stop: stopPostgres },
    ownerUrl: OWNER,
    appUrl: APP,
  } as unknown as StartedPostgres;
  const redis = { container: { stop: stopRedis }, url: REDIS } as unknown as StartedRedis;
  const provided = new Map<string, string>();
  const logs: string[] = [];
  const deps: GlobalSetupDeps = {
    startPostgres: () => Promise.resolve(postgres),
    startRedis: () => Promise.resolve(redis),
    migrateDatabase: vi.fn(() => Promise.resolve()),
    log: (line) => logs.push(line),
    ...overrides,
  };
  const project = {
    provide: (key: string, value: string) => provided.set(key, value),
  } as unknown as Parameters<typeof setup>[0];
  return { deps, project, provided, logs, stopPostgres, stopRedis };
}

describe('enforceContainerPolicy', () => {
  it('desactiva la reutilización de contenedores', () => {
    const env: Record<string, string | undefined> = { TESTCONTAINERS_REUSE_ENABLE: 'true' };
    enforceContainerPolicy(env);
    expect(env['TESTCONTAINERS_REUSE_ENABLE']).toBe('false');
  });

  it('no admite Ryuk desactivado', () => {
    expect(() => {
      enforceContainerPolicy({ TESTCONTAINERS_RYUK_DISABLED: 'true' });
    }).toThrow('Ryuk debe estar activo');
  });
});

describe('setup (globalSetup)', () => {
  it('migra con el rol dueño, entrega las URL, mide el arranque y el teardown destruye todo', async () => {
    const { deps, project, provided, logs, stopPostgres, stopRedis } = fakes();
    const teardown = await setup(project, deps);

    expect(deps.migrateDatabase).toHaveBeenCalledWith(OWNER);
    expect(Object.fromEntries(provided)).toEqual({
      postgresOwnerUrl: OWNER,
      postgresAppUrl: APP,
      redisUrl: REDIS,
    });
    expect(logs[0]).toMatch(/^\[harness\] contenedores listos en \d+ ms; migraciones en \d+ ms\n$/);

    await teardown();
    expect(stopPostgres).toHaveBeenCalledOnce();
    expect(stopRedis).toHaveBeenCalledOnce();
  });

  it('si Redis no arranca, para Postgres y relanza el error', async () => {
    const { deps, project, stopPostgres } = fakes({
      startRedis: () => Promise.reject(new Error('redis caído')),
    });
    await expect(setup(project, deps)).rejects.toThrow('redis caído');
    expect(stopPostgres).toHaveBeenCalledOnce();
  });

  it('si Postgres no arranca, para Redis y relanza el error', async () => {
    const { deps, project, stopRedis } = fakes({
      startPostgres: () => Promise.reject(new Error('postgres caído')),
    });
    await expect(setup(project, deps)).rejects.toThrow('postgres caído');
    expect(stopRedis).toHaveBeenCalledOnce();
  });

  it('si fallan las migraciones, para los dos contenedores y relanza el error', async () => {
    const { deps, project, provided, stopPostgres, stopRedis } = fakes({
      migrateDatabase: () => Promise.reject(new Error('migración rota')),
    });
    await expect(setup(project, deps)).rejects.toThrow('migración rota');
    expect(stopPostgres).toHaveBeenCalledOnce();
    expect(stopRedis).toHaveBeenCalledOnce();
    expect(provided.size).toBe(0);
  });

  it('el teardown para ambos aunque uno falle, y relanza ese fallo', async () => {
    const { deps, project, stopPostgres, stopRedis } = fakes();
    stopPostgres.mockRejectedValueOnce(new Error('stop fallido'));
    const teardown = await setup(project, deps);
    await expect(teardown()).rejects.toThrow('stop fallido');
    expect(stopRedis).toHaveBeenCalledOnce();
  });
});
