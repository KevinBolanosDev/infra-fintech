import { describe, expect, it, vi } from 'vitest';

import {
  buildTruncateStatement,
  DISPOSABLE_MARKER_SQL,
  quoteIdentifier,
  resetDatabase,
  resetRedis,
  type ResettableClient,
} from './reset.js';

describe('buildTruncateStatement', () => {
  it('vacía todas las tablas salvo _prisma_migrations, reiniciando secuencias y en cascada', () => {
    expect(buildTruncateStatement(['_prisma_migrations', 'charges', 'audit_log'])).toBe(
      'TRUNCATE TABLE "public"."charges", "public"."audit_log" RESTART IDENTITY CASCADE',
    );
  });

  it('sin tablas que vaciar no hay sentencia', () => {
    expect(buildTruncateStatement([])).toBeUndefined();
    expect(buildTruncateStatement(['_prisma_migrations'])).toBeUndefined();
  });

  it('escapa las comillas de los identificadores', () => {
    expect(quoteIdentifier('raro"nombre')).toBe('"raro""nombre"');
  });
});

describe('resetDatabase', () => {
  function client(tables: string[], marker: string | null = 'true') {
    const executed: string[] = [];
    const fake = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ marker }])
        .mockResolvedValueOnce(tables.map((tablename) => ({ tablename }))),
      $executeRawUnsafe: vi.fn((query: string) => {
        executed.push(query);
        return Promise.resolve(0);
      }),
    };
    return { fake: fake as unknown as ResettableClient, executed };
  }

  it('consulta las tablas de public y las vacía', async () => {
    const { fake, executed } = client(['_prisma_migrations', 'charges']);
    await resetDatabase(fake);
    expect(executed).toEqual(['TRUNCATE TABLE "public"."charges" RESTART IDENTITY CASCADE']);
  });

  it.each([null, 'false', ''])(
    'se niega a vaciar una base sin la marca de desechable del harness (%j)',
    async (marker) => {
      const { fake, executed } = client(['charges'], marker);
      await expect(resetDatabase(fake)).rejects.toThrow('solo vacía la base desechable');
      expect(executed).toEqual([]);
    },
  );

  it('el SQL de la marca la pone en la base fintech', () => {
    expect(DISPOSABLE_MARKER_SQL).toBe(
      "ALTER DATABASE fintech SET fintech_harness.disposable = 'true'",
    );
  });

  it('sin tablas no ejecuta nada', async () => {
    const { fake, executed } = client(['_prisma_migrations']);
    await resetDatabase(fake);
    expect(executed).toEqual([]);
  });
});

describe('resetRedis', () => {
  it('hace FLUSHDB', async () => {
    const flushdb = vi.fn(() => Promise.resolve('OK'));
    await resetRedis({ flushdb });
    expect(flushdb).toHaveBeenCalledOnce();
  });
});
