/**
 * Limpieza entre pruebas (Q-6): `TRUNCATE ... RESTART IDENTITY CASCADE` de todas las tablas del
 * esquema `public` salvo `_prisma_migrations`, con el rol dueño. Redis: `FLUSHDB`.
 */

export const MIGRATIONS_TABLE = '_prisma_migrations';

/** Parámetro que solo pone el harness en la base de su contenedor (ver `startPostgres`). */
export const DISPOSABLE_MARKER = 'fintech_harness.disposable';

/** SQL (superusuario) que marca la base `fintech` del contenedor como desechable. */
export const DISPOSABLE_MARKER_SQL = `ALTER DATABASE fintech SET ${DISPOSABLE_MARKER} = 'true'`;

/** Identificador entre comillas dobles, con las comillas internas duplicadas. */
export function quoteIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

/** Sentencia de limpieza, o `undefined` si no hay tablas que vaciar. */
export function buildTruncateStatement(tables: readonly string[]): string | undefined {
  const targets = tables.filter((table) => table !== MIGRATIONS_TABLE);
  if (targets.length === 0) {
    return undefined;
  }
  const list = targets.map((table) => `"public".${quoteIdentifier(table)}`).join(', ');
  return `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`;
}

/** Lo mínimo del cliente de Prisma que necesita la limpieza. */
export interface ResettableClient {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): PromiseLike<T>;
  $executeRawUnsafe(query: string): PromiseLike<number>;
}

/**
 * Vacía todas las tablas de la base. Necesita el rol dueño (`fintech_app` no tiene `TRUNCATE`).
 * Se niega si la base no lleva la marca de desechable del harness (nunca vacía Compose ni otra base).
 */
export async function resetDatabase(client: ResettableClient): Promise<void> {
  const [marker] = await client.$queryRaw<{ marker: string | null }[]>`
    SELECT current_setting(${DISPOSABLE_MARKER}, true) AS marker`;
  if (marker?.marker !== 'true') {
    throw new Error(
      'Harness: resetDatabase solo vacía la base desechable del contenedor del harness.',
    );
  }
  const rows = await client.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  const statement = buildTruncateStatement(rows.map((row) => row.tablename));
  if (statement !== undefined) {
    await client.$executeRawUnsafe(statement);
  }
}

/** Vacía la base de Redis del contenedor. */
export async function resetRedis(redis: { flushdb(): PromiseLike<unknown> }): Promise<void> {
  await redis.flushdb();
}
