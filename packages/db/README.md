# @repo/db

Acceso a PostgreSQL con Prisma 7 (ADR-0009): esquema, migraciones, cliente generado y semilla. Paquete compilado (ADR-0005).

## Uso

```ts
import { createPrismaClient } from '@repo/db';

// La cadena llega de la configuración validada de quien llama: la fábrica no lee el entorno
// (solo la semilla, como programa, lee DATABASE_URL).
const prisma = createPrismaClient({ connectionString });
```

Solo lo importan `infrastructure/` de `api`, `worker` y `platform`, y `packages/testing` (`docs/architecture-rules.md`).

## Estructura

| Ruta | Contenido |
| --- | --- |
| `prisma/schema.prisma` | Esquema (generador `prisma-client`, PostgreSQL). Sin modelos en la 0.10 |
| `prisma/migrations/` | Migraciones versionadas (llegan con la primera tabla). Nunca se editan una vez versionadas |
| `src/client.ts` | `createPrismaClient({ connectionString })` con `@prisma/adapter-pg` |
| `src/seed.ts` | Semilla idempotente (`prisma db seed` → `node packages/db/dist/seed.js`) |
| `src/generated/prisma/` | Cliente generado por `db:generate`; **no se versiona** |

La configuración del CLI (`prisma.config.ts`) está en la raíz del repositorio.

## Comandos (desde la raíz)

```bash
cp .env.example .env                      # una vez: DATABASE_URL sintética del Postgres de Docker
pnpm infra:up                             # Postgres, Redis y Mailpit
pnpm prisma validate
pnpm prisma generate                      # o: pnpm turbo run db:generate --filter=@repo/db
pnpm prisma migrate status                # código 1 hasta la primera migración ("not managed by Prisma Migrate")
pnpm turbo run build --filter=@repo/db && pnpm prisma db seed
pnpm turbo run lint typecheck test --filter=@repo/db
```

Flujo de migraciones (`--create-only`, revisión humana, aplicación): ADR-0009, sección 4.
