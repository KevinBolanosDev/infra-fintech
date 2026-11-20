import { describe, expect, it } from 'vitest';

import { createTestPrismaClient, type HarnessUrls, harnessUrls } from './context.js';

const URLS: HarnessUrls = {
  postgresOwnerUrl: 'postgresql://fintech_owner:test-owner@127.0.0.1:1/fintech',
  postgresAppUrl: 'postgresql://fintech_app:test-app@127.0.0.1:1/fintech',
  redisUrl: 'redis://127.0.0.1:2',
};

function reader(values: Partial<HarnessUrls>) {
  return <K extends keyof HarnessUrls>(key: K): HarnessUrls[K] | undefined => values[key];
}

describe('harnessUrls', () => {
  it('devuelve las URL que entregó el globalSetup', () => {
    expect(harnessUrls(reader(URLS))).toEqual(URLS);
  });

  it.each(['postgresOwnerUrl', 'postgresAppUrl', 'redisUrl'] as const)(
    'falla con un mensaje claro si falta %s (globalSetup sin configurar)',
    (missing) => {
      const values: Partial<HarnessUrls> = Object.fromEntries(
        Object.entries(URLS).filter(([key]) => key !== missing),
      );
      expect(() => harnessUrls(reader(values))).toThrow('falta el globalSetup de @repo/testing');
    },
  );

  it('sin globalSetup, inject no da valores', () => {
    expect(() => harnessUrls()).toThrow('falta el globalSetup');
  });
});

describe('createTestPrismaClient', () => {
  it('crea clientes para el rol de la app y para el dueño sin conectarse', async () => {
    const app = createTestPrismaClient('app', URLS);
    const owner = createTestPrismaClient('owner', URLS);
    expect(typeof app.$queryRaw).toBe('function');
    expect(typeof owner.$queryRaw).toBe('function');
    await Promise.all([app.$disconnect(), owner.$disconnect()]);
  });

  it('por defecto usa el rol de la app', async () => {
    const client = createTestPrismaClient(undefined, URLS);
    expect(typeof client.$executeRaw).toBe('function');
    await client.$disconnect();
  });
});
