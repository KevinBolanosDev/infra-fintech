import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { registerHarnessDatabaseUrl } from '../db/migrate.js';
import { DISPOSABLE_MARKER_SQL } from '../db/reset.js';
import { POSTGRES_IMAGE } from './images.js';

/** Contraseñas sintéticas del contenedor desechable (nunca credenciales reales). */
const PASSWORDS = {
  superuser: 'test-superuser',
  owner: 'test-owner',
  app: 'test-app',
  readonly: 'test-readonly',
} as const;

/** Mismo script de roles y bases que Compose (Q-5): `fintech_owner`, `fintech_app`, `fintech_readonly`. */
const ROLES_SCRIPT = new URL(
  '../../../../infra/docker/postgres/init/01-roles-y-bases.sh',
  import.meta.url,
);

export interface StartedPostgres {
  readonly container: StartedPostgreSqlContainer;
  /** Rol dueño: migraciones y limpieza entre pruebas. */
  readonly ownerUrl: string;
  /** Rol de la aplicación (solo DML): lo que usa el código bajo prueba. */
  readonly appUrl: string;
}

function urlFor(container: StartedPostgreSqlContainer, role: string, password: string): string {
  const host = container.getHost();
  const port = String(container.getPort());
  return `postgresql://${role}:${password}@${host}:${port}/fintech`;
}

/** Arranca un Postgres desechable con los roles de Compose y registra sus URL para la salvaguarda. */
export async function startPostgres(): Promise<StartedPostgres> {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withUsername('postgres')
    .withPassword(PASSWORDS.superuser)
    .withDatabase('postgres')
    .withEnvironment({
      FINTECH_OWNER_PASSWORD: PASSWORDS.owner,
      FINTECH_APP_PASSWORD: PASSWORDS.app,
      FINTECH_READONLY_PASSWORD: PASSWORDS.readonly,
    })
    .withCopyFilesToContainer([
      {
        source: fileURLToPath(ROLES_SCRIPT),
        target: '/docker-entrypoint-initdb.d/01-roles-y-bases.sh',
        mode: 0o755,
      },
    ])
    .start();

  // Marca la base como desechable: `resetDatabase` se niega a vaciar una base sin esta marca.
  const marked = await container.exec([
    'psql',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-c',
    DISPOSABLE_MARKER_SQL,
  ]);
  if (marked.exitCode !== 0) {
    await container.stop();
    throw new Error('Harness: no se pudo marcar la base del contenedor como desechable.');
  }

  const ownerUrl = urlFor(container, 'fintech_owner', PASSWORDS.owner);
  const appUrl = urlFor(container, 'fintech_app', PASSWORDS.app);
  registerHarnessDatabaseUrl(ownerUrl);
  return { container, ownerUrl, appUrl };
}
