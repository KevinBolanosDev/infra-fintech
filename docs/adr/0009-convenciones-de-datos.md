# ADR-0009 — Convenciones de datos, Prisma 7 en `packages/db` y flujo de migraciones

| Campo | Valor |
| --- | --- |
| Estado | Aceptado (decisiones D-12 y Q-1 a Q-6 de la sub-fase 0.10 y checkpoint de revisión humana aprobados por el usuario, 2026-11-19) |
| Fecha | 2026-11-19 |
| Decisores | Usuario (dueño del proyecto) |
| Sub-fase / fase | 0.10 (Fase 0) |
| Relacionado con | D-09 y ADR-0004 (roles e infraestructura local); D-12; ADR-0005 (paquetes compilados); reglas no negociables 1, 2 y 10 de `CLAUDE.md` |

## Contexto

Todos los modelos de las fases siguientes heredan estas convenciones, así que se fijan antes de la primera tabla. El plan las ubicaba en `0004-convenciones-de-datos.md`, pero el ADR-0004 ya es "Infraestructura local"; por eso van aquí.

Prisma 7 cambia respecto de la 6: el generador `prisma-client` escribe TypeScript en una ruta propia (no en `node_modules`), la URL de conexión vive en `prisma.config.ts` y no en el esquema, el cliente exige un adaptador de controlador, y el CLI **no carga archivos `.env`**.

## Decisión

### 1. Convenciones de datos

| Tema | Convención |
| --- | --- |
| Identificadores | UUIDv7 generado por Prisma: `id String @id @default(uuid(7)) @db.Uuid`. Ordenables por tiempo; nunca enteros autoincrementales expuestos. Lo genera el cliente, no la base: un `INSERT` en SQL (migraciones, triggers) debe dar el `id` explícitamente |
| Dinero | `BigInt` de **centavos** (`amount_cents`); nunca `Decimal`, `Float` ni `Int`. Una restricción `CHECK` en la migración cuando el signo esté acotado |
| Fechas y horas | `DateTime @db.Timestamptz(3)`: un instante, que se escribe y se lee en UTC (la sesión y el controlador trabajan en UTC); se muestran en `America/Bogota`. Fechas sin hora (por ejemplo, el día de vencimiento) con `@db.Date` |
| Hora de negocio | Toda marca de tiempo con significado de negocio (asiento del ledger, auditoría, `outbox`, vencimientos, confirmaciones) la **entrega `ClockService` explícitamente** al crear el registro (regla 6 de `CLAUDE.md`). `@default(now())` usa el reloj de PostgreSQL y solo vale para columnas puramente operativas; con el reloj simulado de los escenarios, la hora de negocio sería otra |
| Nombres | Modelos en `PascalCase` y campos en `camelCase` en Prisma; tablas y columnas en `snake_case` en la base con `@@map` y `@map`. Tablas en plural (`ledger_transactions`) |
| Marcas de tiempo | `createdAt` lo da `ClockService` (fila anterior); `updatedAt` solo en tablas mutables, también desde `ClockService` en el caso de uso. Las tablas de solo inserción (ledger, `audit_log`, `outbox`) no llevan `updatedAt` |
| Solo inserción | Los privilegios por defecto de `fintech_app` incluyen `UPDATE` y `DELETE` (ADR-0004). La migración de cada tabla de solo inserción (`ledger_*`, `audit_log`, `outbox`, `provider_events`) incluye `REVOKE UPDATE, DELETE ON <tabla> FROM fintech_app` y, además, el trigger que lo impide también al dueño (0.15) |
| Restricciones | En la base, no solo en el código: `NOT NULL`, `UNIQUE`, claves foráneas, `CHECK` |
| Lo que Prisma no expresa | Índices parciales, `CHECK`, triggers (por ejemplo, el de solo inserción de la 0.15) y permisos: **SQL dentro de la misma migración**, después del SQL generado |
| Saldos | Se calculan desde el ledger; no se guardan columnas de saldo |

### 2. Prisma 7 en el monorepo (D-12 = a)

- `prisma.config.ts` en la **raíz** (desde ahí se ejecutan `pnpm prisma ...` y el MCP `prisma-local`). Apunta a `packages/db/prisma/schema.prisma` y a `packages/db/prisma/migrations`.
- `datasource.url` = `process.env['DATABASE_URL']`, no `env()`: `env()` falla en `prisma generate` si falta la variable, y generar no necesita base (CI y Turbo con `envMode: strict`).
- Carga del entorno (Q-3 = a): `process.loadEnvFile()` de Node 24 sobre el `.env` de la raíz **si existe**; las variables ya definidas tienen prioridad. `.env.example` en la raíz con valores sintéticos. Sin `dotenv`.
- Generador `prisma-client` con `output = "../src/generated/prisma"`, `runtime = "nodejs"`, `moduleFormat = "esm"`, `generatedFileExtension = "ts"`, `importFileExtension = "js"` (compatible con `tsc` en Node16 ESM).
- El cliente generado **no se versiona** (`.gitignore`): lo crea la tarea `db:generate` de Turbo (entradas: el esquema y `prisma.config.ts`; salida: `src/generated/**`), de la que dependen `build`, `typecheck`, `lint` y `test` de `@repo/db` (`packages/db/turbo.json`). ESLint, Prettier y la cobertura ignoran `generated/`. `tsc` sí lo compila: los archivos generados llevan `// @ts-nocheck`, así que no obligan a relajar el `strict` del repositorio.
- `@repo/db` es un paquete compilado (ADR-0005). Expone `createPrismaClient({ connectionString })` con `@prisma/adapter-pg`: recibe la cadena (no lee el entorno) y no abre conexiones al crearse. La api y el worker lo usarán con el rol `fintech_app` desde la 0.13 (Q-5: sin variable nueva todavía).
- Versiones exactas: `prisma` (raíz, desarrollo), `@prisma/client` y `@prisma/adapter-pg` `7.10.1`; `pg` y `@types/pg` `8.23.1` entran como dependencias del adaptador. No se usa la 8 (`latest` en npm es un RC).

### 3. Roles

- `DATABASE_URL` del CLI usa el rol dueño `fintech_owner` (migraciones). Con `CREATEDB` en local, `migrate dev` crea y borra la base sombra solo; no hace falta `SHADOW_DATABASE_URL`.
- La aplicación nunca usa el rol dueño: `fintech_app` (solo DML), ver ADR-0004.

### 4. Flujo de migraciones

1. Cambiar `schema.prisma`.
2. `pnpm prisma migrate dev --create-only --name <cambio_en_snake_case>`: genera el SQL **sin aplicarlo**.
3. Añadir al final del `migration.sql` lo que Prisma no expresa (índices parciales, `CHECK`, triggers, `GRANT`).
4. **Revisión humana** del SQL (obligatoria: migraciones, ledger, auth, dinero).
5. `pnpm prisma migrate dev`: aplica en local y regenera el cliente.
6. CI y entornos: `prisma migrate deploy`. La política de pruebas exige aplicar todas las migraciones desde una base vacía y correr la semilla.

Reglas: nunca se edita una migración ya versionada; un cambio destructivo va en dos pasos (expandir y luego contraer); `migrate reset` y `db push` con pérdida de datos exigen consentimiento explícito del usuario (Prisma los bloquea para agentes).

### 5. Semilla

`prisma db seed` ejecuta `node packages/db/dist/seed.js` (Q-4 = a): la semilla compilada, sin `tsx`; requiere `pnpm turbo run build --filter=@repo/db` antes. Comprueba la conexión con una consulta real (`SELECT 1`; con adaptador, `$connect()` no conecta) y luego ejecuta sus pasos, que deben ser idempotentes (`upsert` por clave natural) y sin datos de negocio. En la 0.10 no tiene pasos. Ante un error imprime solo el mensaje, nunca la cadena de conexión.

## Alternativas consideradas

| Alternativa | Por qué se descarta |
| --- | --- |
| `prisma.config.ts` en `packages/db` (D-12 b) | El MCP `prisma-local` y los permisos `pnpm prisma ...` se ejecutan desde la raíz; habría que cambiar `.mcp.json` y `.claude/settings.json` |
| Versionar el cliente generado | Diffs enormes y riesgo de desincronización con el esquema |
| `dotenv` | Una dependencia más para lo que Node 24 ya hace (`process.loadEnvFile`) |
| `tsx` para la semilla | Herramienta fuera del stack; la semilla compilada basta |
| Identificadores `cuid` o enteros | El plan pide UUIDv7 (ordenables por tiempo) |

## Consecuencias

- Antes de `typecheck`, `build`, `lint` o `test` de `@repo/db`, Turbo genera el cliente; un clon limpio funciona sin pasos manuales.
- Para usar el CLI o el MCP en local hay que copiar `.env.example` a `.env` en la raíz (o exportar `DATABASE_URL`).
- `prisma migrate status` sale con código 1 mientras la base no tenga migraciones ("The current database is not managed by Prisma Migrate"); es el estado esperado hasta la primera migración.
- El CLI de Prisma avisa de la actualización a la 8 (`PRISMA_HIDE_UPDATE_MESSAGE=1` lo silencia); pasar a la 8 exige un ADR.
- La versión `7.10.1` está en tres sitios (`package.json` de la raíz, `packages/db/package.json` y `.mcp.json`): se cambian juntas.
- `prisma.config.ts` importa `prisma/config` desde la raíz: la regla "Prisma solo en `infrastructure/` y `packages/db`" no aplica a la raíz, que no es ningún paquete (caso fijado en `boundaries.spec.ts`). Su lógica (cargar `.env` si existe) se verifica con los comandos de esta sección, no con pruebas unitarias.

## Verificación

```bash
pnpm prisma validate
pnpm prisma generate
pnpm prisma migrate status
pnpm turbo run typecheck build --filter=@repo/db
git check-ignore -v packages/db/src/generated/prisma/client.ts
```
