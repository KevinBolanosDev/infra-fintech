# @repo/testing

Harness de pruebas de integración (ADR-0010): Postgres y Redis **reales y desechables** con Testcontainers, con las mismas imágenes y roles que `infra/docker/compose.yaml`, migraciones aplicadas y limpieza entre pruebas. Solo lo importan las pruebas de `api`, `worker` y `platform` (`docs/architecture-rules.md`).

## Cómo escribir una `*.int-spec.ts`

1. Configuración de integración del paquete (`vitest.int.config.ts`):

   ```ts
   import { createNodeVitestConfig } from '@repo/config/vitest/node'; // o createNestVitestConfig

   export default createNodeVitestConfig({
     kind: 'integration',
     globalSetup: ['@repo/testing/global-setup'],
   });
   ```

   El `globalSetup` arranca un Postgres y un Redis por ejecución, aplica las migraciones con el rol dueño y entrega las URL. El perfil de integración da 120 s por prueba y por hook y ejecuta los archivos en serie.

2. La prueba, en `test/integration/<nombre>.int-spec.ts`:

   ```ts
   import { createTestPrismaClient, harnessUrls, resetDatabase, resetRedis } from '@repo/testing';
   import { Redis } from 'ioredis';
   import { afterAll, beforeEach, it } from 'vitest';

   const app = createTestPrismaClient();          // rol fintech_app: lo que usa el código bajo prueba
   const owner = createTestPrismaClient('owner'); // rol fintech_owner: preparar datos y limpiar
   const redis = new Redis(harnessUrls().redisUrl);

   beforeEach(async () => {
     await resetDatabase(owner); // TRUNCATE de todo public salvo _prisma_migrations (solo si la base es del harness)
     await resetRedis(redis);    // FLUSHDB
   });

   afterAll(async () => {
     await Promise.all([app.$disconnect(), owner.$disconnect(), redis.quit()]);
   });
   ```

Reglas:

- Nunca contra el Postgres de Compose ni contra la red: solo las URL de `harnessUrls()`.
- Datos sintéticos únicamente.
- El código bajo prueba usa el rol de la aplicación; el dueño solo para preparar y limpiar.
- La hora de negocio llega con el reloj controlable (0.12), nunca con `Date.now()`.

## Seguridad de la limpieza

`resetDatabase` se niega a vaciar una base que no lleve la marca `fintech_harness.disposable`, que solo pone el harness en la base de su contenedor. Una prueba que por error le pase un cliente del Postgres de Compose falla sin borrar nada.

## Seguridad de las migraciones

`migrateDatabase(url)` despliega las migraciones (`prisma migrate deploy`) **solo** sobre la URL del contenedor que el propio harness creó en ese proceso, y arma el entorno del proceso hijo desde cero (ignora `DATABASE_URL` del entorno). Cualquier otra URL se rechaza sin lanzar nada. El agente no ejecuta ese comando a mano: solo vía `pnpm test:int` (ADR-0010).

## Comandos

```bash
pnpm turbo run test --filter=@repo/testing        # unitarias de las partes puras (80 % de líneas)
pnpm turbo run test:int --filter=@repo/testing    # suite de humo: contenedores, SELECT 1, PING
docker ps --filter label=org.testcontainers=true  # vacío unos segundos después de terminar
```

Requiere Docker (Docker Desktop con integración WSL en local; el runner de CI lo trae).
