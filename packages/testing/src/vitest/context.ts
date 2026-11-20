import { createPrismaClient, type PrismaClient } from '@repo/db';
import { inject } from 'vitest';

/** URL que el `globalSetup` del harness entrega a las pruebas (`project.provide`). */
export interface HarnessUrls {
  readonly postgresOwnerUrl: string;
  readonly postgresAppUrl: string;
  readonly redisUrl: string;
}

// Tipos de `provide`/`inject` (fusión de interfaces de Vitest).
declare module 'vitest' {
  export interface ProvidedContext {
    postgresOwnerUrl: string;
    postgresAppUrl: string;
    redisUrl: string;
  }
}

type Inject = <K extends keyof HarnessUrls>(key: K) => HarnessUrls[K] | undefined;

/** Lee las URL del harness; falla con un mensaje claro si el `globalSetup` no está configurado. */
export function harnessUrls(read: Inject = inject): HarnessUrls {
  const postgresOwnerUrl = read('postgresOwnerUrl');
  const postgresAppUrl = read('postgresAppUrl');
  const redisUrl = read('redisUrl');
  if (postgresOwnerUrl === undefined || postgresAppUrl === undefined || redisUrl === undefined) {
    throw new Error(
      'Harness: falta el globalSetup de @repo/testing en la configuración de integración de Vitest.',
    );
  }
  return { postgresOwnerUrl, postgresAppUrl, redisUrl };
}

/**
 * Cliente de Prisma contra el contenedor: `app` (por defecto) con el rol de la aplicación;
 * `owner` con el rol dueño, para preparar datos o limpiar.
 */
export function createTestPrismaClient(
  role: 'app' | 'owner' = 'app',
  urls: HarnessUrls = harnessUrls(),
): PrismaClient {
  return createPrismaClient({
    connectionString: role === 'owner' ? urls.postgresOwnerUrl : urls.postgresAppUrl,
  });
}
