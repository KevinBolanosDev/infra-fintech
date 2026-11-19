// Configuración del CLI de Prisma 7 (D-12, ADR-0009). Vive en la raíz porque desde aquí se ejecutan
// `pnpm prisma ...` y el MCP `prisma-local`; el esquema y las migraciones viven en packages/db.
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'prisma/config';

// Prisma 7 no carga archivos de entorno. Se carga el de la raíz si existe (nunca se versiona; ver
// .env.example). Las variables ya definidas en el entorno tienen prioridad sobre el archivo.
try {
  process.loadEnvFile(fileURLToPath(new URL('.env', import.meta.url)));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
    throw error;
  }
}

export default defineConfig({
  schema: 'packages/db/prisma/schema.prisma',
  migrations: {
    path: 'packages/db/prisma/migrations',
    // Semilla compilada (requiere `pnpm turbo run build --filter=@repo/db`).
    seed: 'node packages/db/dist/seed.js',
  },
  datasource: {
    // `process.env` y no `env()`: `prisma generate` no necesita base y debe funcionar sin la variable
    // (CI y Turbo con envMode strict). Rol dueño (`fintech_owner`): migraciones.
    url: process.env['DATABASE_URL'],
  },
});
