import { performance } from 'node:perf_hooks';

import type { TestProject } from 'vitest/node';

import { type StartedPostgres, startPostgres } from '../containers/postgres.js';
import { type StartedRedis, startRedis } from '../containers/redis.js';
import { clearHarnessDatabaseUrls, migrateDatabase } from '../db/migrate.js';

type Provide = Pick<TestProject, 'provide'>;

/** Ryuk (el reaper de Testcontainers) siempre activo y nunca reutilizar contenedores (Q-3). */
export function enforceContainerPolicy(
  env: Record<string, string | undefined> = process.env,
): void {
  if (env['TESTCONTAINERS_RYUK_DISABLED'] === 'true') {
    throw new Error(
      'Harness: Ryuk debe estar activo (TESTCONTAINERS_RYUK_DISABLED=true no se admite).',
    );
  }
  env['TESTCONTAINERS_REUSE_ENABLE'] = 'false';
}

async function stopAll(started: readonly { container: { stop(): Promise<unknown> } }[]) {
  clearHarnessDatabaseUrls();
  const results = await Promise.allSettled(started.map(({ container }) => container.stop()));
  const failed = results.find((result) => result.status === 'rejected');
  if (failed !== undefined) {
    throw failed.reason;
  }
}

export interface GlobalSetupDeps {
  readonly startPostgres: () => Promise<StartedPostgres>;
  readonly startRedis: () => Promise<StartedRedis>;
  readonly migrateDatabase: (url: string) => Promise<void>;
  readonly log: (line: string) => void;
}

const DEFAULT_DEPS: GlobalSetupDeps = {
  startPostgres,
  startRedis,
  migrateDatabase: (url) => migrateDatabase(url),
  log: (line) => process.stdout.write(line),
};

/**
 * `globalSetup` de Vitest (sub-fase 0.11): arranca Postgres y Redis desechables una vez por
 * ejecución, aplica las migraciones y entrega las URL a las pruebas. Devuelve el teardown, que los
 * destruye. Si algo falla a medias, para lo que ya arrancó antes de relanzar el error.
 */
export async function setup(
  project: Provide,
  deps: GlobalSetupDeps = DEFAULT_DEPS,
): Promise<() => Promise<void>> {
  enforceContainerPolicy();

  // Medición operativa del arranque (no es hora de negocio).
  const started = performance.now();
  const [postgres, redis] = await Promise.allSettled([deps.startPostgres(), deps.startRedis()]);
  const running = [postgres, redis].flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
  if (postgres.status === 'rejected' || redis.status === 'rejected') {
    await stopAll(running);
    throw postgres.status === 'rejected'
      ? postgres.reason
      : (redis as PromiseRejectedResult).reason;
  }

  const containersReady = performance.now();
  try {
    await deps.migrateDatabase(postgres.value.ownerUrl);
  } catch (error) {
    await stopAll(running);
    throw error;
  }
  const migrated = performance.now();

  deps.log(
    `[harness] contenedores listos en ${String(Math.round(containersReady - started))} ms; ` +
      `migraciones en ${String(Math.round(migrated - containersReady))} ms\n`,
  );

  project.provide('postgresOwnerUrl', postgres.value.ownerUrl);
  project.provide('postgresAppUrl', postgres.value.appUrl);
  project.provide('redisUrl', redis.value.url);

  return () => stopAll(running);
}
