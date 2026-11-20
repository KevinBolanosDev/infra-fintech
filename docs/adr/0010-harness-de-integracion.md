# ADR-0010 — Harness de pruebas de integración y migraciones contra el contenedor desechable

| Campo | Valor |
| --- | --- |
| Estado | Aceptado (decisiones del usuario Q-1 a Q-9 y decisiones 1 y 2 de la sub-fase 0.11, 2026-11-19) |
| Fecha | 2026-11-19 |
| Decisores | Usuario (dueño del proyecto) |
| Sub-fase / fase | 0.11 (Fase 0) |
| Relacionado con | D-09 y ADR-0004 (imágenes y roles); ADR-0009 (Prisma y flujo de migraciones); P-01; política de pruebas del plan maestro |

## Contexto

La política de pruebas exige integración con Postgres y Redis **reales y desechables** (Testcontainers), nunca una base en memoria ni el Postgres de Compose. El harness debe aplicar las migraciones versionadas sobre una base vacía. El hook `.claude/hooks/guard-bash.sh` prohíbe al agente escribir en Bash `prisma migrate reset` o `prisma migrate deploy` ("deploy solo en CI/migrator").

## Decisión

1. **Librería y versiones (Q-1):** `testcontainers`, `@testcontainers/postgresql` y `@testcontainers/redis` `12.2.1` exactos (`testcontainers` fijado también directamente), `ioredis` `6.0.0`, y `prisma` `7.10.1` declarado en `@repo/testing` porque el harness lanza su CLI. La 12.2.2 se publicó el mismo día y no cumplía `minimumReleaseAge`; no se creó ninguna excepción.
2. **Imágenes (Q-2):** las mismas de `infra/docker/compose.yaml`, con etiqueta y digest (`src/containers/images.ts`). `images.spec.ts` falla si se separan.
3. **Ryuk y reutilización (Q-3):** Ryuk activado (borra los contenedores si el proceso muere); `TESTCONTAINERS_REUSE_ENABLE=false` y ningún `withReuse()`. Ryuk usa la imagen que elige la librería (`testcontainers/ryuk:0.14.0`), sin digest.
4. **Roles (Q-5):** el contenedor de Postgres ejecuta el mismo `infra/docker/postgres/init/01-roles-y-bases.sh` de Compose, con contraseñas sintéticas. Migraciones y limpieza con `fintech_owner`; el código bajo prueba con `fintech_app`.
5. **Migraciones (Q-4, decisión 2):** el harness ejecuta, como proceso hijo, exactamente:

   ```text
   node <node_modules>/prisma/build/index.js migrate deploy --config <raíz>/prisma.config.ts
   ```

   es decir, `prisma migrate deploy`, con estas condiciones autorizadas por escrito por el usuario:
   - solo acepta la URL del contenedor que el propio harness creó en ese proceso (registro en `src/db/migrate.ts`); cualquier otra se rechaza antes de lanzar nada;
   - arma el entorno del proceso hijo desde cero (`DATABASE_URL` del contenedor, `PATH`, `HOME`): **ignora cualquier `DATABASE_URL` del entorno**;
   - `migrate.spec.ts` comprueba que rechaza URLs de Compose, sandbox, producción y de otro puerto, y que no pasa la `DATABASE_URL` del entorno;
   - el agente **no** ejecuta ese comando a mano: solo a través de `pnpm test:int`. El hook no se modifica.

   Comprobado en la 0.11: el hook inspecciona solo el texto de los comandos Bash del agente (`.tool_input.command`); no interviene sobre los procesos hijos de `pnpm test:int`.
   - el proceso hijo tiene un tiempo máximo de 100 s (`SIGKILL` al vencer), por debajo de los 120 s del perfil.
6. **Aislamiento (Q-6):** contenedores por ejecución de Vitest (`globalSetup`), archivos en serie, y antes de cada prueba `resetDatabase` (`TRUNCATE ... RESTART IDENTITY CASCADE` de todo `public` salvo `_prisma_migrations`, con el rol dueño) y `resetRedis` (`FLUSHDB`). **Salvaguarda del `TRUNCATE`:** al arrancar, el harness marca la base del contenedor (`ALTER DATABASE fintech SET fintech_harness.disposable = 'true'`, como superusuario del contenedor) y `resetDatabase` se niega a vaciar una base sin esa marca. Comprobado en la 0.11 contra el Postgres de Compose: rechaza sin vaciar nada.
7. **Robustez del `globalSetup`:** si un contenedor no arranca o fallan las migraciones, para lo ya arrancado antes de relanzar el error; el teardown para los dos aunque uno falle. Exige Ryuk activo (`TESTCONTAINERS_RYUK_DISABLED=true` hace fallar el arranque) y fija `TESTCONTAINERS_REUSE_ENABLE=false`. Probado con dependencias falsas (`global-setup.spec.ts`).
8. **Perfil de integración (Q-8):** `@repo/config` acepta `globalSetup` y, en `kind: 'integration'`, fija `testTimeout`/`hookTimeout` en 120 s y `fileParallelism: false`.
9. **Cobertura (Q-9):** perfil `utility`; solo el arranque real de contenedores (`src/containers/{postgres,redis}.ts`) queda fuera de la cobertura unitaria y se cubre con la suite de humo de integración.
10. **Scripts de instalación (decisión 1):** `cpu-features`, `ssh2` y `protobufjs` (vía `dockerode`) quedan en `allowBuilds: false`.
11. **Reloj manual (Q-7):** pasa a la 0.12, junto con el puerto `Clock`.

## Alternativas consideradas

| Alternativa | Por qué se descarta |
| --- | --- |
| Aplicar los `migration.sql` directamente | Mecanismo distinto al de CI y producción; no valida lo mismo |
| Desactivar Ryuk | Contenedores huérfanos si la corrida muere |
| Revertir una transacción por prueba | Choca con el código que abre sus propias transacciones (`UnitOfWork`, 0.13) |
| Un superusuario en el contenedor | Las pruebas de permisos (solo inserción, 0.15) perderían sentido |

## Consecuencias

- Cada `pnpm test:int` de un paquete que use el harness arranca y destruye su propio Postgres y Redis (medido en la 0.11: unos 7 s de contenedores y 1,5 s de migraciones, con las imágenes ya descargadas).
- Tras la corrida, Ryuk tarda unos segundos (su tiempo de reconexión) en borrarse a sí mismo; después no queda ningún contenedor con `label=org.testcontainers=true`.
- CI necesita Docker en el runner (los de GitHub Actions con Ubuntu lo traen). **Deuda:** hoy CI no ejecuta `test:int`; debe añadirse cuando los consumidores (`platform`, `api`) tengan suites de integración.
- `prisma.config.ts` carga el `.env` de la raíz también en el proceso hijo de las migraciones: `DATABASE_URL` no se pisa (manda la del contenedor), pero el hijo ve el resto de variables de ese archivo.
- Cuando la 0.15 añada triggers de solo inserción, un trigger `BEFORE TRUNCATE` rompería `resetDatabase`: la 0.15 debe definir cómo convive con la limpieza del harness (por ejemplo, que el trigger se salte cuando la sesión lleva `fintech_harness.disposable`).
- Ryuk usa `testcontainers/ryuk:0.14.0` sin digest; se podría fijar con `RYUK_CONTAINER_IMAGE` por coherencia con D-09.
- Con `envMode: strict`, Turbo no pasa `DOCKER_HOST` ni similares a `test:int`; funciona con el socket por defecto de Docker Desktop. Un entorno con otro contexto de Docker necesitaría `passThroughEnv` (pendiente de decisión).

## Verificación

```bash
pnpm test:int
docker ps --filter label=org.testcontainers=true      # vacío al terminar (tras unos segundos)
```
