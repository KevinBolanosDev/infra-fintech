import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

/**
 * Migraciones del harness (Q-4, sub-fase 0.11; ADR-0010): el CLI de Prisma despliega las
 * migraciones versionadas, **solo** contra una base que este mismo proceso creó en un contenedor
 * desechable. Cualquier otra URL (la de Compose, sandbox, producción o `DATABASE_URL` del entorno)
 * se rechaza antes de lanzar nada.
 */

const harnessUrls = new Set<string>();

/** Lo llama `startPostgres` al crear el contenedor. Nada más registra URL. */
export function registerHarnessDatabaseUrl(url: string): void {
  harnessUrls.add(url);
}

/** Olvida las URL registradas (al destruir el contenedor y en pruebas). */
export function clearHarnessDatabaseUrls(): void {
  harnessUrls.clear();
}

/** Falla si la URL no es la de un contenedor creado por este harness. */
export function assertHarnessDatabaseUrl(url: string): void {
  if (!harnessUrls.has(url)) {
    throw new Error(
      'Harness: solo se migra la base del contenedor desechable que creó el propio harness.',
    );
  }
}

/** Tiempo máximo del despliegue de migraciones (por debajo de los 120 s del perfil de integración). */
export const MIGRATE_TIMEOUT_MS = 100_000;

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const PRISMA_CONFIG = fileURLToPath(new URL('../../../../prisma.config.ts', import.meta.url));

export interface MigrateCommand {
  readonly file: string;
  readonly args: readonly string[];
  readonly options: {
    readonly cwd: string;
    readonly env: Readonly<Record<string, string>>;
    /** Un despliegue colgado no bloquea la corrida para siempre. */
    readonly timeout: number;
    readonly killSignal: 'SIGKILL';
  };
}

/**
 * Comando del CLI de Prisma. El entorno del proceso hijo se arma desde cero: `DATABASE_URL` es la
 * del contenedor y se ignora cualquier `DATABASE_URL` del entorno del agente o de CI.
 */
export function buildMigrateCommand(
  url: string,
  parentEnv: Readonly<Record<string, string | undefined>> = process.env,
): MigrateCommand {
  assertHarnessDatabaseUrl(url);
  const require = createRequire(import.meta.url);
  const env: Record<string, string> = {
    DATABASE_URL: url,
    PRISMA_HIDE_UPDATE_MESSAGE: '1',
  };
  for (const name of ['PATH', 'HOME'] as const) {
    const value = parentEnv[name];
    if (value !== undefined) {
      env[name] = value;
    }
  }
  return {
    file: process.execPath,
    args: [
      require.resolve('prisma/build/index.js'),
      'migrate',
      'deploy',
      '--config',
      PRISMA_CONFIG,
    ],
    options: { cwd: REPO_ROOT, env, timeout: MIGRATE_TIMEOUT_MS, killSignal: 'SIGKILL' },
  };
}

type ExecFile = (
  file: string,
  args: readonly string[],
  options: MigrateCommand['options'],
) => Promise<unknown>;

/** Aplica las migraciones versionadas sobre la base del contenedor. */
export async function migrateDatabase(
  url: string,
  run: ExecFile = promisify(execFile),
): Promise<void> {
  const command = buildMigrateCommand(url);
  await run(command.file, command.args, command.options);
}
