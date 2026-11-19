import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { createPrismaClient } from './client.js';
import type { PrismaClient } from './generated/prisma/client.js';

/** Paso de la semilla. Cada paso debe ser idempotente (por ejemplo, `upsert` por clave natural). */
export type SeedStep = (client: PrismaClient) => Promise<void>;

/** Pasos de la semilla. Vacío en la sub-fase 0.10: todavía no hay tablas ni datos de referencia. */
export const SEED_STEPS: readonly SeedStep[] = [];

type SeedClient = Pick<PrismaClient, '$queryRaw' | '$disconnect'>;

/**
 * Comprueba la conexión con una consulta real (con adaptador, `$connect()` no conecta), ejecuta los
 * pasos en orden y desconecta siempre, también si algo falla.
 */
export async function runSeed(
  client: SeedClient,
  steps: readonly SeedStep[] = SEED_STEPS,
): Promise<void> {
  try {
    await client.$queryRaw`SELECT 1`;
    for (const step of steps) {
      await step(client as PrismaClient);
    }
  } finally {
    await client.$disconnect();
  }
}

/** Punto de entrada de `prisma db seed` (`node packages/db/dist/seed.js`, ADR-0009). */
export async function main(
  env: Readonly<Record<string, string | undefined>>,
  create: typeof createPrismaClient = createPrismaClient,
): Promise<void> {
  const connectionString = env['DATABASE_URL'];
  if (connectionString === undefined || connectionString.trim() === '') {
    throw new Error('Semilla: falta DATABASE_URL');
  }
  await runSeed(create({ connectionString }));
}

interface SeedOutput {
  readonly stdout: { write(text: string): unknown };
  readonly stderr: { write(text: string): unknown };
}

/** Ejecuta la semilla como programa y devuelve el código de salida. */
export async function runCli(
  env: Readonly<Record<string, string | undefined>>,
  output: SeedOutput,
  create: typeof createPrismaClient = createPrismaClient,
): Promise<number> {
  try {
    await main(env, create);
    output.stdout.write('Semilla aplicada.\n');
    return 0;
  } catch (error: unknown) {
    // Solo el mensaje, sin la pila y con la cadena de conexión tapada si el error la cita.
    const message = error instanceof Error ? error.message : 'error';
    const connectionString = env['DATABASE_URL'];
    const safe =
      connectionString === undefined || connectionString.trim() === ''
        ? message
        : message.replaceAll(connectionString, '***');
    output.stderr.write(`Semilla fallida: ${safe}\n`);
    return 1;
  }
}

const entry = process.argv[1];
// `realpathSync`: si se invoca por un enlace simbólico, igual se reconoce como programa.
if (entry !== undefined && import.meta.url === pathToFileURL(realpathSync(entry)).href) {
  process.exitCode = await runCli(process.env, process);
}
