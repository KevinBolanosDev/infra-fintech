import { existsSync, readdirSync } from 'node:fs';

import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetDatabase, resetRedis } from '../../src/db/reset.js';
import { createTestPrismaClient, harnessUrls } from '../../src/vitest/context.js';

const COMPOSE_PORT = '5432';

describe('Harness de integración (humo)', () => {
  const urls = harnessUrls();
  const app = createTestPrismaClient('app');
  const owner = createTestPrismaClient('owner');
  const redis = new Redis(urls.redisUrl, { lazyConnect: true });

  beforeAll(async () => {
    await redis.connect();
  });

  afterAll(async () => {
    await Promise.all([app.$disconnect(), owner.$disconnect(), redis.quit()]);
  });

  it('no usa el Postgres de Compose: la base es la del contenedor', () => {
    expect(new URL(urls.postgresOwnerUrl).port).not.toBe(COMPOSE_PORT);
    expect(new URL(urls.postgresAppUrl).pathname).toBe('/fintech');
  });

  it('SELECT 1 con Prisma, conectado como fintech_app', async () => {
    const rows = await app.$queryRaw<{ ok: number; role: string }[]>`
      SELECT 1 AS ok, current_user::text AS role`;
    expect(rows).toEqual([{ ok: 1, role: 'fintech_app' }]);
  });

  it('las migraciones versionadas se desplegaron todas, con el rol dueño', async () => {
    const rows = await owner.$queryRaw<{ owner: string }[]>`
      SELECT tableowner::text AS owner FROM pg_tables
      WHERE schemaname = 'public' AND tablename = '_prisma_migrations'`;
    expect(rows).toEqual([{ owner: 'fintech_owner' }]);

    const migrationsDir = new URL('../../../db/prisma/migrations/', import.meta.url);
    const versioned = existsSync(migrationsDir)
      ? readdirSync(migrationsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory())
          .length
      : 0; // Sin carpeta todavía (sub-fase 0.11): ninguna migración versionada.
    const applied = await owner.$queryRaw<{ total: bigint }[]>`
      SELECT count(*) AS total FROM _prisma_migrations WHERE finished_at IS NOT NULL`;
    expect(applied[0]?.total).toBe(BigInt(versioned));
  });

  it('la base del contenedor lleva la marca de desechable del harness', async () => {
    const rows = await owner.$queryRaw<{ marker: string | null }[]>`
      SELECT current_setting('fintech_harness.disposable', true) AS marker`;
    expect(rows).toEqual([{ marker: 'true' }]);
  });

  it('fintech_app no puede crear tablas (roles de Compose)', async () => {
    await expect(app.$executeRawUnsafe('CREATE TABLE no_permitida (id int)')).rejects.toThrow(
      /permission denied/,
    );
  });

  it('PING de Redis', async () => {
    expect(await redis.ping()).toBe('PONG');
  });

  it('resetDatabase y resetRedis dejan todo vacío', async () => {
    await owner.$executeRawUnsafe('CREATE TABLE prueba_reset (id serial PRIMARY KEY, valor text)');
    await owner.$executeRawUnsafe("INSERT INTO prueba_reset (valor) VALUES ('a'), ('b')");
    await redis.set('clave-sintetica', '1');

    await resetDatabase(owner);
    await resetRedis(redis);

    const rows = await owner.$queryRaw<
      { total: bigint }[]
    >`SELECT count(*) AS total FROM prueba_reset`;
    expect(rows[0]?.total).toBe(0n);
    expect(await redis.dbsize()).toBe(0);
    const migrations = await owner.$queryRaw<{ total: bigint }[]>`
      SELECT count(*) AS total FROM pg_tables WHERE tablename = '_prisma_migrations'`;
    expect(migrations[0]?.total).toBe(1n);
    await owner.$executeRawUnsafe('DROP TABLE prueba_reset');
  });
});
