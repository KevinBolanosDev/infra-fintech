import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  assertHarnessDatabaseUrl,
  buildMigrateCommand,
  clearHarnessDatabaseUrls,
  MIGRATE_TIMEOUT_MS,
  migrateDatabase,
  registerHarnessDatabaseUrl,
} from './migrate.js';

const CONTAINER_URL = 'postgresql://fintech_owner:test-owner@127.0.0.1:55432/fintech';

afterEach(() => {
  clearHarnessDatabaseUrls();
});

describe('salvaguarda de migraciones del harness', () => {
  it.each([
    ['Compose local', 'postgresql://fintech_owner:local-dev-owner@127.0.0.1:5432/fintech'],
    ['sandbox', 'postgresql://fintech_owner:x@db.sandbox.fintech.example:5432/fintech'],
    ['producción', 'postgresql://fintech_owner:x@db.prod.fintech.example:5432/fintech'],
    ['otro puerto del mismo host', 'postgresql://fintech_owner:test-owner@127.0.0.1:55433/fintech'],
  ])('rechaza una URL que el harness no creó (%s)', (_name, url) => {
    registerHarnessDatabaseUrl(CONTAINER_URL);
    expect(() => {
      assertHarnessDatabaseUrl(url);
    }).toThrow('solo se migra la base del contenedor desechable');
  });

  it('acepta la URL del contenedor que el harness registró', () => {
    registerHarnessDatabaseUrl(CONTAINER_URL);
    expect(() => {
      assertHarnessDatabaseUrl(CONTAINER_URL);
    }).not.toThrow();
  });

  it('tras destruir el contenedor, su URL deja de valer', () => {
    registerHarnessDatabaseUrl(CONTAINER_URL);
    clearHarnessDatabaseUrls();
    expect(() => {
      assertHarnessDatabaseUrl(CONTAINER_URL);
    }).toThrow();
  });
});

describe('buildMigrateCommand', () => {
  it('ignora DATABASE_URL del entorno: el proceso hijo solo recibe la del contenedor', () => {
    registerHarnessDatabaseUrl(CONTAINER_URL);
    const command = buildMigrateCommand(CONTAINER_URL, {
      DATABASE_URL: 'postgresql://fintech_owner:x@db.prod.fintech.example:5432/fintech',
      PATH: '/usr/bin',
      HOME: '/home/sintetico',
      OTRA_VARIABLE: 'no-pasa',
    });
    expect(command.options.env).toEqual({
      DATABASE_URL: CONTAINER_URL,
      PRISMA_HIDE_UPDATE_MESSAGE: '1',
      PATH: '/usr/bin',
      HOME: '/home/sintetico',
    });
  });

  it('lanza el CLI de Prisma con la config de la raíz, sin PATH ni HOME si faltan', () => {
    registerHarnessDatabaseUrl(CONTAINER_URL);
    const command = buildMigrateCommand(CONTAINER_URL, {});
    expect(command.file).toBe(process.execPath);
    expect(command.args[0]).toMatch(/prisma[\\/]build[\\/]index\.js$/);
    expect(command.args.slice(1, 3)).toEqual(['migrate', 'deploy']);
    expect(command.args[3]).toBe('--config');
    expect(command.args[4]).toMatch(/[\\/]prisma\.config\.ts$/);
    expect(command.options.env).toEqual({
      DATABASE_URL: CONTAINER_URL,
      PRISMA_HIDE_UPDATE_MESSAGE: '1',
    });
    expect(command.options).toMatchObject({ timeout: MIGRATE_TIMEOUT_MS, killSignal: 'SIGKILL' });
    expect(MIGRATE_TIMEOUT_MS).toBeLessThan(120_000);
  });

  it('se niega a armar el comando para una URL que no es del harness', () => {
    expect(() => buildMigrateCommand(CONTAINER_URL, {})).toThrow();
  });
});

describe('migrateDatabase', () => {
  it('ejecuta el comando armado', async () => {
    registerHarnessDatabaseUrl(CONTAINER_URL);
    const calls: (readonly string[])[] = [];
    const run = vi.fn((file: string, args: readonly string[]) => {
      calls.push([file, ...args]);
      return Promise.resolve();
    });
    await migrateDatabase(CONTAINER_URL, run);
    expect(run).toHaveBeenCalledOnce();
    expect(calls[0]).toContain('deploy');
  });

  it('no ejecuta nada si la URL no es del harness', async () => {
    const run = vi.fn(() => Promise.resolve());
    await expect(migrateDatabase(CONTAINER_URL, run)).rejects.toThrow();
    expect(run).not.toHaveBeenCalled();
  });
});
