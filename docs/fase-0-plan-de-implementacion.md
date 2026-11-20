# Fase 0 — Plan de implementación (Fundaciones)

| Campo | Valor |
| --- | --- |
| Proyecto | Plataforma fintech de arriendos (`fintech-arriendos`) |
| Fecha del plan | 2026-11-12 |
| Versión | 1.1 (2026-11-13: alineado con la v2 del plan maestro; el alcance de la Fase 0 no cambia) |
| Elaborado por | `development-planner` |
| Ejecuta | `backend-implementer` (`.claude/agents/backend-implementer.md`), una sub-fase a la vez |
| Fuente de verdad del alcance | `docs/plan-de-desarrollo-plataforma-fintech-de-arriendos-(MVP-y-escala).md`, v2 (sección "Fases y cronograma", fila 0) |
| Reglas que el plan respeta | `docs/architecture-rules.md`, `CLAUDE.md`, `docs/skills-y-MCPs-para-el-desarrollo-con-claude-code.md` |

---

## 1. Resumen del alcance de la Fase 0

**Objetivo.** Dejar las fundaciones técnicas sobre las que se construye todo lo demás: monorepo, calidad automatizada, entorno local en contenedores, base NestJS (api, worker, simulador), persistencia con Prisma 7 y los cuatro módulos transversales (`clock`, `audit`, `outbox`, `idempotency`), con su primer modelo de datos.

**Lo que dice el plan maestro para la Fase 0 (semanas 1–2):**

- Persona A (plataforma): monorepo, Turborepo, CI, Docker Compose, NestJS base, Prisma, imágenes Docker, logger, Sentry.
- Persona B (dominio): reglas de dependencia, `ClockService`, `outbox`, `idempotency`, `audit`, primer modelo de datos.
- **Criterio de salida (literal):** "`pnpm dev` levanta todo; pipeline en verde; una migración aplicada".
- Del documento de Skills y MCPs, para la semana 0/Fase 0: skills propias `nest-module-scaffold` y `testing-policy`, subagente `test-writer`, MCP de Prisma contra la base de Docker. Verificación: "crear un módulo de ejemplo sigue las capas y trae sus pruebas".
- De "Decisiones pendientes" del plan: "Auth: probar los hooks de auditoría en la semana 1" (se cubre con un spike opcional, sub-fase 0.27).

**Qué entrega la Fase 0 (en concreto):**

1. Monorepo pnpm + Turborepo con TypeScript estricto, ESLint, Prettier y Vitest compartidos.
2. Reglas de dependencia de `architecture-rules.md` convertidas en una verificación que rompe el build.
3. Docker Compose local (Postgres, Redis, Mailpit; el almacenamiento S3 se difiere a la Fase 3, ver ADR-0004) y, sobre él, `api`, `worker` y `provider-sim` con recarga (`docker compose watch`); `pnpm dev` los levanta.
4. `apps/api` con configuración validada, `/health`, contexto de petición, errores RFC 9457 y logger con enmascarado de datos personales.
5. Prisma 7 en `packages/db`, `UnitOfWork` transaccional y las tres primeras tablas (`audit_log`, `outbox`, `idempotency_keys`) con sus migraciones.
6. Los módulos transversales `clock`, `audit`, `outbox` (con relevo en el worker) e `idempotency`, cada uno con pruebas contra Postgres/Redis reales.
7. `apps/worker` (BullMQ) y `apps/provider-sim` (esqueleto con `/health`, que se niega a arrancar en producción).
8. Imágenes Docker de `api`, `worker`, `provider-sim` y `migrator`, y CI en GitHub Actions (calidad, integración, migraciones sobre base vacía, construcción de imágenes, escaneos de seguridad, CODEOWNERS, plantilla de PR, Renovate).
9. ADRs de cada decisión de arquitectura y las dos skills propias de la semana 0.

**Dimensión.** 28 sub-fases, unas **112 horas de ejecución del agente** (108 sin el spike opcional) más el tiempo de revisión humana de cada checkpoint. El plan maestro asume dos personas en paralelo durante 1–2 semanas; con un solo implementador y aprobación sub-fase por sub-fase, el calendario realista es de **3–4 semanas**. Las estimaciones son del planner, sin datos históricos: se recalibran tras la sub-fase 0.3. Candidatas a diferir si hay que ajustarse al cronograma: 0.27 (spike), 0.21 (OpenTelemetry), 0.26 (Renovate).

**Impacto de la v2 del plan maestro (2026-11-13).** El plan maestro cambió el gancho del producto al ahorro para compra de vivienda (Meta Casa) y agregó la fase 2B con cuatro módulos (`housing-parameters`, `home-goals`, `savings`, `rewards`). La Fase 0 es infraestructura y no depende del producto: **sus 28 sub-fases, criterios, estimaciones y compuerta quedan iguales.** Lo único que cambia aquí es la tabla de fuera de alcance (sección 2), una nota en el checkpoint de 0.7 y la bitácora. Donde este documento dice "Fase 2" se refiere a la fase 2A del plan maestro v2 (cobros y simulador); las fases 1, 3, 4 y 5 conservan su número.

---

## 2. Fuera de alcance (fases posteriores)

Nada de esta lista se implementa en la Fase 0, aunque aparezca en el plan maestro.

| Elemento | Fase | Nota |
| --- | --- | --- |
| `Money`, máquina de estados, reglas del ledger, reajuste IPC en `packages/domain` | 1 | En Fase 0 `domain` solo recibe puertos (`Clock`, `UnitOfWork`, `DomainEvent`) |
| Módulo `ledger`, trigger de partida doble, `ledger-rules` | 1 | |
| `auth` con Better Auth, Google, 2FA; `users`; `consents`; límite de peticiones; cifrado de columnas | 1 | En Fase 0 solo el spike opcional 0.27 |
| `properties`, `leases`, `payout-destinations` | 1 | Desde la v2 del plan maestro, `leases` incluye el contrato autodeclarado |
| Skills propias `ledger-rules`, `prisma-migration-safety`, `audit-events`; subagentes `security-reviewer`, `db-reviewer` | 1 | |
| `provider-sim` funcional (llave dinámica, webhooks, KYC, panel `/sim`), reloj avanzado por calendario, `seed:scenario` | 2A | En Fase 0 solo el esqueleto |
| Paquete `integrations` con interfaces y adaptadores, variables `*_PROVIDER` | 2A | El directorio queda con `.gitkeep` |
| `charges`, `provider-events`, `identity`, tareas del worker de negocio, tabla `jobs_dead_letter` | 2A | Ver D-15 |
| Ahorro para vivienda: `housing-parameters`, `home-goals`, `savings`, `rewards`; ruta a la vivienda y máquina de estados del aporte en `packages/domain`; interfaz `SavingsProvider`; entidad de ahorro en `provider-sim`; tablas de ahorro y `regulatory_parameters` | 2B | Nuevo en la v2 del plan maestro. Nada de esto se adelanta en la Fase 0, ni siquiera tablas o puertos vacíos |
| `receipts`, `certificates` (incluida la carpeta de vivienda), `score`, `notifications`, `backoffice`, OpenAPI final, `api-client`, MCP de Sentry, skill `phase-gate` | 3 | |
| Despliegue a `staging`, hosting (Railway/Render), publicación de imágenes en un registro | 3 | La decisión de hosting se puede tomar en la semana 2 pero no se implementa |
| `apps/web`, `packages/ui`, PWA, FSD, Playwright, Storybook | 4 | Las reglas FSD se escriben en 0.4 pero sin código web |
| Pruebas de carga (k6), mutación (Stryker), seguridad externa, KMS | 4–5 | |
| Dev Container | Opcional | Solo si el usuario lo pide |

---

## 3. Estado verificado del repositorio y del entorno

Verificado el 2026-11-12 leyendo el repositorio y consultando el registro de npm. No se asumió nada.

### 3.1 Repositorio

| Elemento | Estado real |
| --- | --- |
| Git | Rama `main`, **sin ningún commit** y **sin remoto**. Sin versionar: `.claude/`, `.gitignore`, `.mcp.json`, `CLAUDE.md`, `docs/` |
| `apps/` y `packages/` | Existen `apps/{api,worker,provider-sim,web}` y `packages/{api-client,config,contracts,db,domain,integrations,observability,testing,ui}`, **todos vacíos** (0 archivos) |
| `infra/docker/` | Existe y está vacío |
| Raíz | No existen `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig`, ESLint, Prettier, Dockerfiles, CI ni `.env.example` |
| `docs/` | Plan maestro, doc de Skills/MCPs y `architecture-rules.md`. No existe `docs/adr/` |
| `.gitignore` | Cubre `.env*`, `*.pem`, `*.key`, `node_modules/`, `.turbo/`, `dist/`, `.next/`. Falta `coverage/`, `*.tsbuildinfo` y la ruta del cliente de Prisma generado |
| `.claude/settings.json` | Permisos y hooks ya configurados (ver 3.3). Sin `Stop` hook |
| Agentes | `backend-implementer`, `architect-reviewer`, `development-planner` |
| Skills del proyecto | `nestjs-best-practices` (escrita para Bun: adaptar a pnpm/Node), `prisma-cli`, `prisma-client-api`, `turborepo`, `vercel-react-best-practices`, `web-design-guidelines`. Faltan las propias `nest-module-scaffold` y `testing-policy` |
| MCPs (`.mcp.json`) | `context7`, `github` (solo lectura), `prisma-local` (`prisma@7.10.1 mcp`), `playwright`. **El MCP de GitHub falló al conectar** ("Authorization header is badly formatted"): no bloquea la Fase 0, pero conviene corregirlo |

### 3.2 Entorno de la máquina

| Elemento | Estado | Consecuencia |
| --- | --- | --- |
| Node | **Resuelto (P-02):** instalado Node 24 (`.nvmrc` = `v24.22.3`); antes había `v20.20.2` y `v22.13.0` | Node 20 está fuera de soporte según el calendario oficial (fin de vida en abril de 2026; verificar en nodejs.org). Varias dependencias vigentes ya no lo soportan. Decidido D-01 = B (Node 24) |
| pnpm | `12.18.0` (corepack disponible) | Versión nueva: validar sintaxis de workspaces y scripts de build con Context7, no de memoria |
| **Docker** | CLI y Docker Compose `v2.39.1-desktop.1` instalados en Windows, pero **el motor no está corriendo** y **`docker` no está disponible dentro de la distro WSL** (integración desactivada) | **Bloquea las sub-fases 0.6 y siguientes que usan contenedores** (ver P-01). Las sub-fases 0.1–0.5 no lo necesitan |
| `jq` | Instalado | Los hooks lo necesitan (fallan cerrado sin él) |
| `gh` (GitHub CLI) | No instalado | La verificación de CI se hace desde el navegador de GitHub |
| Remoto Git | **Resuelto (P-03):** `origin` apunta al repositorio de GitHub del usuario | Ya se puede verificar CI remoto en 0.5; el `push` lo hace el usuario |

### 3.3 Permisos y hooks que condicionan al implementador

- **Sin confirmación** (`allow`): `pnpm turbo run *`, `pnpm test*`, `pnpm lint*`, `pnpm typecheck*`, `pnpm prisma validate*`, `pnpm prisma generate*`, `pnpm prisma migrate status*`, `docker compose *`.
- **Piden confirmación al usuario** (`ask`): `pnpm add*`, `pnpm remove*`, `pnpm install*`, `pnpm dlx*`, `npx *`, `pnpm prisma migrate dev*`, `git push*`, `git reset --hard*`, `git clean*`. Cualquier otro comando (por ejemplo `pnpm dev`, `pnpm build`, `docker build`, `docker ps`) también preguntará.
- **Prohibido** (`deny` y hooks): leer o editar `.env*`, llaves y certificados; editar `pnpm-lock.yaml` a mano; `prisma migrate reset` y `prisma migrate deploy`; `db push` destructivo; `git push --force`; `rm` recursivo y forzado; `--no-verify`; `curl`/`wget` a hosts que no sean localhost; cualquier comando que mencione un archivo `.env*` (salvo `.env.example`, `.env.sample`, `.env.template`); editar migraciones ya versionadas en git.
- **Piden confirmación por hook:** editar `.claude/settings.json`, `.claude/hooks/*`, `.claude/settings.local.json` y `.mcp.json`.
- **Hook `PostToolUse` de formato:** en cuanto Prettier y ESLint estén instalados (sub-fase 0.2), cada `Write`/`Edit` sobre `.ts/.js/.json/.yaml/...` los ejecuta; si ESLint deja errores sin corregir, el hook bloquea con código 2. Ignora `node_modules`, `dist`, `.next`, `.claude`, `generated` y `migrations`.

Consecuencia de diseño: los scripts de la raíz se nombran para caer en patrones permitidos (`lint`, `lint:boundaries`, `lint:format`, `typecheck`, `test`, `test:int`) y las verificaciones usan `pnpm turbo run <tarea>` en lugar de `pnpm build`.

### 3.4 Matriz de versiones (consulta al registro de npm, 2026-11-12)

| Paquete | Versión `latest` | Requisito de Node / observación |
| --- | --- | --- |
| `prisma` (CLI) | **`8.0.0-rc.33`** (la etiqueta `latest` apunta al RC) | Prisma 7 vigente: `7.10.1`. **Nunca instalar `prisma` sin versión exacta**: `pnpm add -D prisma` traería el RC de Prisma 8, que CLAUDE.md prohíbe sin un ADR |
| `@prisma/client`, `@prisma/adapter-pg` | `7.10.1` | `^20.19 \|\| ^22.12 \|\| >=24` |
| `@nestjs/core` / `@nestjs/common` | `12.5.0` (la serie 11 queda como `legacy`, `11.2.9`) | **Nest 12 es solo ESM** (`"type": "module"`); su repositorio usa `module/moduleResolution: Node16`, TypeScript 5.9.3, `experimentalDecorators`, `emitDecoratorMetadata` y `useDefineForClassFields: false` |
| `typescript` | `7.0.2` | `typescript-eslint@8.72.2` declara soporte solo para `typescript <6.1.0`: **TypeScript 7 no es utilizable con el lint actual**. Hay 5.9.3 y 6.0.3 |
| `vitest` | `5.1.0` | `^22.12 \|\| ^24 \|\| >=26`. La serie 4 (`4.1.12`) admite Node 20 |
| `eslint` | `10.14.0` | `^20.19 \|\| ^22.13 \|\| >=24` (la serie 9 sigue en mantenimiento: `9.39.5`) |
| `dependency-cruiser` | `18.7.2` | `^22 \|\| ^24 \|\| >=26` |
| `eslint-plugin-boundaries` | `7.4.3` | `>=18.18` (verificar su rango de peer de ESLint) |
| `nestjs-pino` | `5.3.1` | `>=22.12.0` |
| `@sentry/nestjs` | `11.12.0` | `>=22.12 <23 \|\| >=23.2` |
| `unplugin-swc` | `2.0.0` | `^20.19 \|\| >=22.12` |
| `better-auth` | `1.7.22` | Peer: `prisma ^5 \|\| ^6 \|\| ^7` |
| Otros | `turbo 2.11.11`, `zod 4.6.7`, `nestjs-zod 5.6.0`, `@nestjs/config 12.1.1`, `bullmq 6.7.5`, `ioredis 6.0.0`, `@testcontainers/postgresql 12.2.1`, `fast-check 4.10.2`, `pino 10.4.0`, `prettier 3.10.1` | |

**No verificado:** compatibilidad cruzada (por ejemplo `nestjs-zod` con Zod 4 y Nest 12, `unplugin-swc` con decoradores en ESM, `eslint-plugin-boundaries` con ESLint 10), sintaxis de pnpm 12 y calendario de Node. El implementador debe comprobarlas con Context7 y pruebas reales en la sub-fase correspondiente, y anotar el resultado en el ADR.

---

## 4. Prerrequisitos y decisiones abiertas

El implementador **no decide** nada de esta sección: se detiene y pide respuesta. Para cada decisión el planner da una recomendación, que es solo una propuesta.

### 4.1 Prerrequisitos (acciones del usuario)

| ID | Acción | Necesaria antes de | Estado |
| --- | --- | --- | --- |
| P-01 | Iniciar Docker Desktop y activar la integración con esta distro WSL (Settings, Resources, WSL integration). Comprobar con `docker version` dentro de WSL | 0.6 (y todo lo que use contenedores: 0.11 en adelante) | **Resuelto** (el usuario confirmó que está listo; el implementador debe comprobar `docker version` al llegar a 0.6) |
| P-02 | Dejar instalada la versión de Node que se decida en D-01 (`nvm install <versión>` y `nvm use`) | 0.1 | **Resuelto**: Node 24 instalado |
| P-03 | Crear el repositorio remoto en GitHub, añadir el remoto y hacer el primer push (ver D-04). Sin esto 0.5, 0.25 y 0.26 no se pueden verificar | 0.5 | **Resuelto**: repositorio creado y remoto conectado |
| P-04 | (Opcional) Corregir el MCP de GitHub (token en variable de entorno, cabecera `Authorization`). Cambios en `.mcp.json` requieren revisión humana | Ninguna | **Pospuesto**: el MCP de GitHub sigue roto; no depender de él |

### 4.2 Decisiones abiertas

**Resueltas el 2026-11-12 (D-01 a D-04):**

- **D-01 = B:** Node 24 (`.nvmrc` `v24.22.3`).
- **D-02 = A:** NestJS 12 ESM + TypeScript 5.9.x, todo el monorepo en ESM. Las skills están escritas para Nest 11/Bun: el implementador adapta sus reglas a Nest 12, pnpm y Node, y consulta Context7 para APIs vigentes. Va en el ADR-0001.
- **D-03 = A:** scope `@repo/*`.
- **D-04 = d (usuario):** el usuario hace todos los commits y `push` y revisa todo manualmente. El implementador **no commitea nunca** (esto reemplaza la recomendación "commitea por orden explícita"). Rama/PR por sub-fase y commit de línea base quedan a criterio del usuario.

**Resuelta el 2026-11-20 (D-13, transmitida por el coordinador):**

- **D-13 = A:** `SystemClock` más reloj controlable en Redis (`now`, `set`, `advance(ms)`); los avances por calendario quedan para la Fase 2. Puerto asíncrono `now(): Promise<Date>` (cambia el contrato del plan) y desfase en Redis. ADR-0011.

**Resuelta el 2026-11-19 (D-12, transmitida por el coordinador):**

- **D-12 = a:** `prisma.config.ts` en la raíz (apunta a `packages/db/prisma/`); cliente generado en `packages/db/src/generated/prisma` por la tarea `db:generate` de Turbo, ignorado por git. Carga de `.env` con `process.loadEnvFile` si existe, semilla compilada (`node packages/db/dist/seed.js`), sin variable de base en la api todavía y cobertura de `db` al 85 % de líneas. ADR-0009.

**Resuelta el 2026-11-19 (D-11, transmitida por el agente principal):**

- **D-11:** cuerpo de error RFC 9457 (`application/problem+json`) con `type` `urn:problem-type:<code-en-minúsculas>`, `title`, `status`, `detail`, `instance` (ruta sin query string), `code` (MAYÚSCULAS_CON_GUION_BAJO), `details` (siempre presente) y `request_id`. Mapeo y registro en ADR-0008.

**Resuelta el 2026-11-18 (transmitida por el coordinador):**

- **D-08 = B:** caché remota de Turborepo **autoalojada**. Infraestructura pospuesta hasta decidir el hosting de staging (Q-1 de 0.5); sin caché remota en los PR. El workflow ya la soporta (solo en push a `main`, activada por `TURBO_API`, `TURBO_TEAM` y el secreto `TURBO_TOKEN`).

**Resueltas el 2026-11-13 (D-05 a D-07, transmitidas por el coordinador):**

- **D-05 = A:** nuevo paquete `packages/platform` (`@repo/platform`) para los módulos NestJS transversales; los de negocio nacen en `apps/api`. Requiere ADR y actualizar `architecture-rules.md` (revisión humana).
- **D-06 = A:** `eslint-plugin-boundaries` como herramienta principal de fronteras.
- **D-07 = propuesta del planner:** filas nuevas en `architecture-rules.md` para `observability`, `config`, `testing` y `platform`, y confirmar como firmes las capas hexagonales de la sección 2. Va en ADR y requiere revisión humana.

Orden cronológico. **Deben responderse antes de arrancar 0.1: D-01, D-02, D-03 y D-04 (respondidas el 2026-11-12, ver abajo).** El resto se responde antes de la sub-fase que bloquean.

| ID | Decisión | Opciones | Recomendación del planner | Bloquea |
| --- | --- | --- | --- | --- |
| D-01 | Versión de Node del proyecto (`.nvmrc`, `engines`, imágenes Docker) | A) Node 22 (ya hay 22.13.0 instalada; usar la última 22.x, porque `skills@1.8.1` pide >=22.20). B) Node 24 | **B (24)**: Node 22 entra en mantenimiento y su fin de vida cae hacia abril de 2027, en plena Fase 5. Node 20 queda descartado. Verificar el calendario en nodejs.org. Todas las dependencias de 3.4 admiten 24 | 0.1 |
| D-02 | Runtime de backend | A) **NestJS 12 (ESM) + TypeScript 5.9.x**, todo el monorepo en ESM (`"type": "module"`, `Node16`, imports relativos con `.js`). B) NestJS 11 (serie `legacy`, CJS) + TypeScript 5.9.x | **A**: proyecto nuevo, Prisma 7 y Better Auth son ESM-first y Nest 11 ya está en `legacy`. Coste: las skills del repositorio están escritas para Nest 11 y el ecosistema (nestjs-zod, nestjs-pino) debe comprobarse con Nest 12. TypeScript 7 queda fuera por typescript-eslint. Es la decisión más difícil de revertir: va en el ADR-0001 | 0.1 |
| D-03 | Scope npm de los paquetes internos | A) `@repo/*`. B) `@fintech/*`. C) otro | **A**: neutro, no depende del nombre del producto (aún pendiente según el plan). Renombrar después es un cambio masivo | 0.1 |
| D-04 | Política de Git | a) ¿Se hace un commit de línea base con lo existente (`.claude/`, `.mcp.json`, `CLAUDE.md`, `docs/`, `.gitignore`)? b) ¿Una rama y un PR por sub-fase (`fase-0/0.N-<slug>`)? c) ¿Quién crea el remoto y hace `push`? d) ¿El implementador puede hacer commits locales o solo preparar cambios? | a) Sí, cuando lo ordenes. b) Sí, PR pequeños como pide CLAUDE.md. c) El usuario (`git push*` pide confirmación). d) ~~El implementador commitea solo por orden explícita~~ Resuelta: el usuario hace los commits | 0.1 (línea base) y 0.5 (remoto) |
| D-05 | Dónde viven los módulos NestJS que usan `api` **y** `worker` (`clock`, `audit`, `outbox`, `idempotency`) | A) Nuevo paquete `packages/platform` (`@repo/platform`) para los transversales; los módulos de negocio nacen en `apps/api` y se extraen cuando el worker los necesite. B) Un paquete único con todos los módulos (transversales y de negocio); las apps quedan como capas finas de cableado. C) Todo en `apps/api` y el worker como segundo punto de entrada del mismo código | **A**: el plan dice "api y worker comparten la lógica de packages", pero **su lista de nueve paquetes no tiene dónde poner módulos NestJS compartidos** y una app no puede importar de otra. A y B coinciden en la Fase 0; la diferencia (dónde van los módulos de negocio) se decide al empezar la Fase 1 o 2. Cualquier opción exige ADR y actualizar `architecture-rules.md` (revisión humana). **En este plan la ruta `{PLATFORM}` significa `packages/platform` bajo la opción A** | 0.4 |
| D-06 | Herramienta que hace cumplir las reglas de dependencia | A) `eslint-plugin-boundaries`. B) `dependency-cruiser`. C) Ambas | **A como principal**: corre dentro de ESLint, así que el hook `PostToolUse` le avisa al agente en el mismo instante en que escribe un import prohibido. B (Node >=22) se puede añadir después para ciclos y huérfanos | 0.4 |
| D-07 | Reglas faltantes en `architecture-rules.md`: no hay fila para `observability`, `testing`, `config`, `api-client`, `ui` ni para el nuevo `platform` | Proponer, en un ADR, una fila para cada uno | Propuesta: `observability` (solo pino/OpenTelemetry/Sentry; sin `domain`, `db`, NestJS ni apps), `config` (nada), `testing` (puede importar `domain`, `contracts`, `db`, `platform`; nunca apps), `platform` (puede importar `domain`, `contracts`, `db`, `observability`, NestJS, BullMQ, ioredis; nunca apps, `web`, `ui`, `integrations`). Además confirmar como firmes las capas hexagonales de la sección 2 (hoy "inferido") | 0.4 |
| D-08 | Caché remota de Turborepo en CI | A) Vercel Remote Cache (gestionada, requiere cuenta y `TURBO_TOKEN`/`TURBO_TEAM`). B) Autoalojada. C) Sin caché remota por ahora (solo caché de GitHub Actions) | **C ahora, A cuando el CI pase de ~5 min**: evita una cuenta más en la semana 1 y una dependencia con un token de terceros. El plan dice "Turborepo con caché remota": confirmar si es requisito de Fase 0 | 0.5 |
| D-09 | Infraestructura local: versiones de imagen y roles de base de datos | Versión mayor de PostgreSQL (17 o 18; la 18 trae `uuidv7()` nativo, pero Prisma genera UUIDv7 en el cliente con `@default(uuid(7))`), Redis, MinIO (diferido a la Fase 3, ADR-0004) y Mailpit. Roles: `owner` (migraciones, `CREATEDB` para la base sombra en local), `app` (solo DML; en `audit_log` solo `INSERT`/`SELECT`), `readonly` (opcional) | Usar la versión mayor de PostgreSQL que soporten Neon/Supabase y RDS en staging. Tres roles. El permiso "solo inserción" del plan **no basta para el dueño de la tabla**, por eso 0.15 añade además un trigger. Etiquetas fijas, nunca `latest` | 0.6 |
| D-10 | Adaptador HTTP de NestJS | A) Express. B) Fastify | **A**: es el predeterminado, Better Auth se monta como manejador de Node y las skills/ejemplos del repositorio asumen Express | 0.8 |
| D-11 | Forma final del cuerpo de error (contrato público de la API) | El plan pide `code`, `message`, `details`, `request_id` "basado en RFC 9457" | El implementador propone la tabla de campos en el diseño previo de 0.9 (por ejemplo `type`, `title`, `status`, `detail`, `instance` más `code`, `details`, `request_id`; `Content-Type: application/problem+json`); el usuario la aprueba antes de implementar | 0.9 |
| D-12 | Prisma: ubicación de `prisma.config.ts` y política del cliente generado | a) Config en la **raíz** apuntando a `packages/db/prisma/...` (los permisos `pnpm prisma validate/generate/migrate status` y el MCP `prisma-local` se ejecutan desde la raíz). b) Config dentro de `packages/db`. Cliente generado (Prisma 7 genera código TS en una ruta propia): ¿versionarlo o ignorarlo y generarlo en el grafo de Turbo? | a) raíz y generar en el grafo de Turbo con la ruta en `.gitignore` (tarea `db:generate` antes de `typecheck`, `build` y `test`). Si el MCP o los permisos no funcionan con b), no insistir | 0.10 |
| D-13 | Alcance del reloj en la Fase 0 | A) Puerto `Clock` + `SystemClock` + reloj controlable respaldado en Redis (`now`, `set`, `advance(ms)`). B) Solo `SystemClock` y el puerto; el reloj controlable llega con el panel de la Fase 2 | **A**: el plan lista `ClockService` en Fase 0 y todo código posterior debe nacer ya inyectándolo. Los avances por calendario (1 día, 1 semana, 1 mes en `America/Bogota`) se dejan para la Fase 2 | 0.12 |
| D-14 | Skills propias (`nest-module-scaffold`, `testing-policy`) y subagente `test-writer`: ¿las escribe el implementador dentro de la Fase 0? | A) Sí, en 0.14, con la skill global `anthropic-skills:skill-creator`, en versión corta. B) Las escribes tú aparte | **A**, con revisión humana (cambian `.claude/**`). Un subagente no hereda hooks ni permisos del proyecto: `test-writer` no puede limitarse por ruta, solo por instrucciones | 0.14 |
| D-15 | Alcance del primer modelo de datos | Propuesto: `audit_log`, `outbox`, `idempotency_keys`. La tabla `jobs_dead_letter` del grupo "Plataforma" se difiere a la Fase 2 (no hay aún ninguna tarea de negocio que la use). `users`/`sessions` son de la Fase 1 | Aceptar lo propuesto. Para `outbox`, confirmar que las columnas de entrega (estado, intentos) son mutables mientras el contenido del evento es inmutable (trigger) | 0.15 |
| D-16 | Sentry y OpenTelemetry | ¿Existe ya un proyecto de Sentry y un DSN de staging? ¿OpenTelemetry solo a consola (plan) o también exportador? | Sentry inactivo (sin DSN) y verificado con un transporte de prueba, sin llamadas a internet; el DSN real lo configuras tú después. OpenTelemetry solo a consola, como dice el plan | 0.21 |
| D-17 | Registro de imágenes, publicación y Trivy | El plan publica en GHCR o ECR en cada fusión a `main` | En la Fase 0 **construir y escanear, sin publicar**; publicar es parte del despliegue a `staging` (Fase 3). Trivy en modo informativo primero y bloqueante para HIGH/CRITICAL con corrección disponible después | 0.25 |
| D-18 | Spike de hooks de auditoría de Better Auth | A) Hacerlo en la Fase 0 (4 h, sin código en `main`). B) Diferirlo al inicio de la Fase 1 | **A**: el plan lo pide para la semana 1 y, si los hooks no pueden escribir en `audit_log` dentro de la misma transacción, cambia el diseño de `audit` y de `auth` | 0.27 |

---

## 5. Seguimiento de sub-fases

Estados: **Pendiente** / **En Progreso** / **Completada** (cumple todos los criterios y el implementador pidió auditoría) / **Aprobada por usuario** (solo tras aprobación explícita en la conversación). "RH" = revisión humana obligatoria según CLAUDE.md (migraciones, `ledger`, `auth`, `provider-events` y todo lo que toque dinero). "Diseño" = el implementador presenta un diseño breve y espera el visto bueno antes de escribir código.

| ID | Sub-fase | Bloque | Est. (h) | Depende de | Decisiones / prerrequisitos | RH | Diseño | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0.1 | Línea base del repositorio y toolchain | A | 2 | — | D-01, D-02, D-03, D-04, P-02 | No | No | Aprobada por usuario |
| 0.2 | Turborepo y configuración compartida | A | 3 | 0.1 | — | No | No | Aprobada por usuario |
| 0.3 | Vitest y política de cobertura | A | 3 | 0.2 | — | No | No | Aprobada por usuario |
| 0.4 | Reglas de dependencia ejecutables | A | 5 | 0.3 | D-05, D-06, D-07 | Sí | Sí | Aprobada por usuario |
| 0.5 | CI base (calidad y secretos) | A | 3 | 0.4 | D-04, D-08, P-03 | No | No | Aprobada por usuario |
| 0.6 | Docker Compose, perfil `infra` | B | 4 | 0.1 | D-09, P-01 | No | Sí | Aprobada por usuario |
| 0.7 | Logger y contexto de ejecución (`observability`) | C | 3 | 0.4 | — | No | No | Aprobada por usuario |
| 0.8 | `apps/api` base: configuración, `/health` y endurecimiento HTTP | C | 4 | 0.7 | D-10 | No | No | Aprobada por usuario |
| 0.9 | Contexto de petición y errores RFC 9457 | C | 4 | 0.8 | D-11 | No | Sí | Aprobada por usuario |
| 0.10 | Prisma 7 en `packages/db` | D | 4 | 0.6, 0.2 | D-12 | Sí | Sí | Aprobada por usuario |
| 0.11 | Harness de pruebas de integración (`packages/testing`) | D | 4 | 0.10, 0.3 | P-01 | No | No | Aprobada por usuario |
| 0.12 | `ClockService` | D | 3 | 0.8, 0.11 | D-13 | No | No | Completada |
| 0.13 | `PrismaService` y `UnitOfWork` | D | 5 | 0.9, 0.11, 0.12 | — | Sí | Sí | Pendiente |
| 0.14 | Skills propias y `test-writer` (versión corta) | E | 4 | 0.12, 0.13 | D-14 | Sí | No | Pendiente |
| 0.15 | Módulo `audit` y primera migración | E | 6 | 0.13, 0.14 | D-15 | Sí | Sí | Pendiente |
| 0.16 | Módulo `outbox` (lado de escritura) | E | 5 | 0.15 | — | Sí | Sí | Pendiente |
| 0.17 | Módulo `idempotency` | E | 6 | 0.16, 0.9 | — | Sí | Sí | Pendiente |
| 0.18 | `apps/worker` base con BullMQ | F | 4 | 0.12, 0.7 | — | No | No | Pendiente |
| 0.19 | Relevo del `outbox` en el worker | F | 5 | 0.16, 0.18 | — | Sí | Sí | Pendiente |
| 0.20 | `apps/provider-sim` base | F | 3 | 0.8 | — | No | No | Pendiente |
| 0.21 | Sentry y OpenTelemetry | F | 5 | 0.18, 0.20 | D-16 | No | No | Pendiente |
| 0.22 | Imagen Docker de `api` | G | 5 | 0.10, 0.8 | — | No | Sí | Pendiente |
| 0.23 | Imágenes de `worker`, `provider-sim` y `migrator` | G | 3 | 0.22, 0.19, 0.20 | — | No | No | Pendiente |
| 0.24 | Compose `backend`/`full`, `watch` y `pnpm dev` | G | 4 | 0.23, 0.6 | — | No | No | Pendiente |
| 0.25 | CI de integración, migraciones e imágenes | H | 4 | 0.24, 0.5 | D-17, P-03 | No | No | Pendiente |
| 0.26 | Gobernanza y cadena de suministro | H | 3 | 0.25 | P-03 | No | No | Pendiente |
| 0.27 | Spike: hooks de auditoría de Better Auth (opcional) | I | 4 | 0.15 | D-18 | Sí | No | Pendiente |
| 0.28 | Compuerta de salida de la Fase 0 | I | 4 | todas | — | Sí | No | Pendiente |

**Total:** 112 h (108 h sin 0.27). Bloques: A monorepo y calidad · B infraestructura local · C base del backend · D persistencia · E módulos transversales · F worker y simulador · G contenedores y `pnpm dev` · H CI completo y gobernanza · I cierre.

**Orden y paralelismo.** El orden de la tabla es el recomendado y secuencial. Las sub-fases 0.1–0.5 no necesitan Docker, así que el usuario puede resolver P-01 mientras tanto. Si algún día hay un segundo implementador, los pares independientes son 0.6 con 0.7, y 0.18 con 0.20.

### Mecánica de aprobación

1. El implementador termina la sub-fase, marca **Completada** y pide auditoría al `development-planner` con el reporte de la sección 6.
2. El planner audita con la plantilla de la sección 13 y emite veredicto: apta para revisión humana, con observaciones o rechazada.
3. El usuario revisa el checkpoint de la sub-fase y responde en la conversación "Aprobada 0.N" (o pide cambios).
4. Solo entonces se marca **Aprobada por usuario** (con fecha en la bitácora de la sección 12) y se puede arrancar la siguiente.

---

## 6. Reglas de trabajo para el implementador

1. **Una sola sub-fase a la vez.** No empezar la 0.N+1 hasta que la 0.N figure como **Aprobada por usuario**. No adelantar trabajo "porque ya estoy en el archivo".
2. **Antes de empezar:** leer la sub-fase completa, `docs/architecture-rules.md`, `CLAUDE.md` y la parte pertinente del plan maestro; verificar el estado real del repositorio (`git status`, estructura, versiones) y comprobar que los prerrequisitos y decisiones que la bloquean están respondidos. Si no lo están, **parar y preguntar**; nunca decidir por el usuario.
3. **Diseño previo** (columna "Diseño" = Sí): presentar un diseño breve (archivos, interfaces, flujo de datos, alternativas descartadas) y esperar el visto bueno antes de escribir código. Es el modo plan que pide CLAUDE.md.
4. **Parar y reportar al terminar.** Al cumplir los criterios, detenerse. Entregar un reporte con: resumen, archivos creados/modificados, dependencias añadidas con su justificación, **salida real y resumida de cada comando de verificación**, criterios cumplidos o no, desvíos del plan, decisiones tomadas, pendientes. Pedir la auditoría al planner. No afirmar que algo "pasa" sin haberlo ejecutado.
5. **No ampliar el alcance.** Un hallazgo fuera de alcance se anota en el reporte (y en la bitácora) y se propone como sub-fase o ajuste; no se implementa.
6. **Respetar `docs/architecture-rules.md` y las reglas no negociables de `CLAUDE.md`:** dinero en `bigint`, hora solo por `ClockService`, ledger y auditoría de solo inserción, idempotencia, nada de acceso a proveedores reales, Prisma solo en `infrastructure/` y `packages/db`. Un import prohibido es un defecto, no un atajo. Al terminar cada sub-fase que cree o mueva archivos, ejecutar el subagente `architect-reviewer` sobre el alcance y adjuntar su resultado (cero hallazgos `BLOQUEANTE` y `ALTA`).
7. **Pruebas con el código.** Ningún archivo con lógica sin su `*.spec.ts` (unitarias junto al archivo, integración en `test/integration/*.int-spec.ts`, e2e en `test/e2e/`). Umbrales según la tabla de "Política de pruebas" del plan. No marcar **Completada** con pruebas en rojo ni con pruebas desactivadas. Ninguna prueba llama a internet.
8. **Dependencias:** versiones **exactas** (sin `^` ni `latest`), verificadas en el registro y con Context7 antes de `pnpm add` (que pedirá confirmación). Para Prisma: siempre `7.10.1` o la 7.x vigente, nunca la etiqueta `latest`. Cada dependencia nueva se justifica en el reporte. No usar `npx`/`pnpm dlx` para paquetes sin versión fijada.
9. **Documentación vigente:** consultar Context7 antes de escribir APIs de NestJS 12, Prisma 7, pnpm 12, Turborepo, Testcontainers, Better Auth o GitHub Actions. La skill `nestjs-best-practices` está escrita para Bun y Nest 11: adaptar a pnpm/Node y Nest 12; Vitest, no Jest.
10. **Seguridad del agente:** no leer ni imprimir secretos; no escribir `.env` literal en comandos (el hook lo bloquea; usar `.env.example`); datos sintéticos únicamente; no usar `--no-verify`; no ejecutar `prisma migrate reset/deploy` ni `db push` destructivo. No usar ningún MCP contra algo que no sea el Postgres de Docker (el conector de Supabase de la sesión **no se usa** en la Fase 0).
11. **Migraciones:** nunca editar una migración ya versionada; flujo `pnpm prisma migrate dev --create-only --name <n>`, revisar el SQL generado, añadir el SQL manual (triggers, permisos, índices parciales) y solo entonces aplicar. Se usa la CLI (que pide confirmación) y **no** la herramienta `migrate-dev` del MCP, para que exista la puerta humana. El MCP `prisma-local` se usa solo para `migrate-status` y Studio. No hacer `git add` de una migración hasta que el usuario la apruebe (el hook `protect-files` vuelve inmutable lo que está en el índice).
12. **Cambios en `.claude/**`, `.mcp.json`, `CLAUDE.md` y `docs/architecture-rules.md`:** solo si la sub-fase los pide, y siempre quedan pendientes de revisión humana explícita.
13. **Git:** el usuario hace todos los commits y pushes; el implementador nunca commitea (D-04 = d). Una sub-fase, una rama, un PR pequeño. Mensajes de commit en español, sin `--no-verify`.
14. **Presupuesto:** si la ejecución supera el doble de la estimación, o aparece un bloqueo que cambia el diseño, parar y reportar antes de seguir.
15. **Estado:** el implementador puede actualizar la columna Estado de la sección 5 a **En Progreso** y **Completada**. **Aprobada por usuario** solo se marca tras la aprobación explícita del usuario.
16. **Idioma:** reportes, ADRs y comentarios de documentación en español; identificadores de código en inglés, salvo los nombres de dominio que fija el plan (`audit_log`, `outbox`, etc.).

### Definición de terminado común a todas las sub-fases

- [ ] Todos los criterios de aceptación de la sub-fase cumplidos, con evidencia en el reporte.
- [ ] `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde (y `pnpm lint:boundaries` desde 0.4); `pnpm test:int` en verde cuando exista.
- [ ] `architect-reviewer` sin hallazgos `BLOQUEANTE` ni `ALTA` sobre el alcance.
- [ ] Dependencias fijadas, justificadas y sin código muerto.
- [ ] `.env.example` actualizado si se añadió una variable de entorno; ningún secreto en archivos versionables.
- [ ] ADR escrito en `docs/adr/` por cada decisión de arquitectura aceptada.
- [ ] Documentación técnica actualizada (README del paquete o de la app cuando corresponda).
- [ ] Reporte entregado y auditoría solicitada al planner.

---

## 7. Convenciones comunes del plan

- **Scope y nombres (D-03 = A):** `@repo/config`, `@repo/domain`, `@repo/contracts`, `@repo/db`, `@repo/observability`, `@repo/testing`, `@repo/platform` (D-05 = A), `@repo/api`, `@repo/worker`, `@repo/provider-sim`.
- **`{PLATFORM}`** = `packages/platform/src`. Si D-05 se resuelve distinto, se reubican esas rutas y la sub-fase 0.4 lo refleja en `architecture-rules.md`.
- **Módulo de ES (D-02 = A):** `"type": "module"` en todos los paquetes, `module`/`moduleResolution` `Node16`, imports relativos con extensión `.js`. Excepción (0.3, ADR-0001 "Correcciones"): las fábricas `.ts` de `packages/config/vitest/` se importan entre sí por el export del propio paquete.
- **Estructura de un módulo NestJS de negocio o transversal:** `domain/`, `application/`, `infrastructure/`, `interface/` (se omiten las capas que no aplican; por ejemplo `audit` no tiene `interface/` en la Fase 0). Los módulos puramente técnicos (`config`, `health`) no llevan las cuatro capas: se documenta en el ADR-0003.
- **Puertos puros en `@repo/domain`:** `Clock`, `UnitOfWork`, `DomainEvent`. Las implementaciones viven en `{PLATFORM}`.
- **Scripts de la raíz:** `lint`, `lint:boundaries`, `lint:format`, `typecheck`, `test`, `test:int`, `build`, `dev`. Las tareas de Turbo: `build`, `typecheck`, `lint`, `lint:boundaries`, `test`, `test:int`, `db:generate`, `dev`.
- **Datos:** ids UUIDv7 (`@db.Uuid @default(uuid(7))`), dinero `BigInt` de centavos, fechas `@db.Timestamptz(3)` en UTC, tablas en `snake_case` con `@@map` y `@map`. Las marcas de tiempo de negocio salen de `Clock`, no de `now()` de la base (un `DEFAULT now()` es solo respaldo).
- **Variables de entorno:** validadas con Zod al arrancar (falla rápido y sin imprimir valores). Cada `.env.example` solo lleva valores sintéticos de desarrollo. Nombres propuestos: `APP_ENV` (`local|test|staging|sandbox|production`), `HTTP_PORT`, `DATABASE_URL` (rol dueño, solo migraciones), `APP_DATABASE_URL` (rol de aplicación), `REDIS_URL`, `ALLOWED_ORIGINS`, `LOG_LEVEL`.
- **Evidencia:** los comandos de verificación se ejecutan desde la raíz del repositorio.
- **Rutas de compose:** `docker compose -f infra/docker/compose.yaml --env-file infra/docker/.env.example ...` (el agente no puede crear ni leer el `.env` real; el usuario lo copia de `.env.example` si quiere valores propios).

---

## 8. Detalle de sub-fases

### Bloque A — Monorepo y calidad (no requiere Docker)

#### SUB-FASE 0.1 — Línea base del repositorio y toolchain

- **Objetivo:** dejar un workspace pnpm funcional y el toolchain fijado y documentado, sin código de negocio.
- **Estimación:** 2 h · **Depende de:** P-02, D-01, D-02, D-03, D-04 · **RH:** No · **Diseño previo:** No.
- **Archivos / paquetes / capas:** raíz del repositorio: `package.json` (`private`, `packageManager`, `engines`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `.nvmrc`, `.npmrc` si hace falta, `.editorconfig`, `.gitignore` (añadir `coverage/`, `*.tsbuildinfo`, `.DS_Store`, ruta del cliente Prisma según D-12), `README.md` mínimo (prerrequisitos), `docs/adr/{README.md,0000-plantilla.md,0001-toolchain-y-versiones.md}`, `.gitkeep` en los directorios que seguirán vacíos toda la fase (`apps/web`, `packages/ui`, `packages/api-client`, `packages/integrations`).
- **Entregables:**
  - Workspace instalable, con `pnpm-lock.yaml` generado por pnpm (no se edita a mano).
  - Política de dependencias con scripts de instalación permitidos (lista explícita para `@swc/core`, `prisma`, `@prisma/engines`, `esbuild`, según la sintaxis de pnpm 12), porque los scripts de build bloqueados por defecto romperían Prisma y SWC más adelante.
  - ADR-0001 con la tabla de versiones exactas, justificadas con la matriz 3.4 y las decisiones D-01 a D-03.
- **Criterios de aceptación:**
  1. `node -v` coincide con `.nvmrc` y con `engines.node`.
  2. `pnpm -v` coincide con `packageManager`.
  3. `pnpm install --frozen-lockfile` termina con código 0 en un clon limpio.
  4. `git status --short` solo muestra los archivos esperados; no hay secretos versionables.
  5. El ADR-0001 contiene versiones exactas comprobadas contra el registro y las alternativas descartadas.
  6. No se instaló ninguna dependencia innecesaria.
- **Skills / MCPs:** Context7 (pnpm 12: workspaces, catálogos, scripts de build, `packageManager`). Skill `turborepo` aún no aplica.
- **Verificación:**
  ```bash
  node -v && pnpm -v
  pnpm install --frozen-lockfile        # pide confirmación (pnpm install*)
  git status --short
  git check-ignore -v coverage/x.txt packages/db/src/generated/x.ts
  ```
- **Checkpoint de revisión humana:** leer el ADR-0001 y confirmar versiones; comprobar `.gitignore`; decidir si se hace ahora el commit de línea base (D-04). El implementador solo commitea si se lo ordenas.
- **Riesgos / decisiones abiertas:** D-01 a D-04. pnpm 12 es más nuevo que el conocimiento del modelo (validar con Context7). Node 22.13 no cumple el `>=22.20` que exige `skills@1.8.1` (ver `.claude/skills/SOURCES.md`).

#### SUB-FASE 0.2 — Turborepo y configuración compartida

- **Objetivo:** grafo de tareas con caché y una configuración única de TypeScript, ESLint y Prettier, validada sobre un primer paquete.
- **Estimación:** 3 h · **Depende de:** 0.1 · **RH:** No · **Diseño previo:** No.
- **Archivos / paquetes / capas:** `turbo.json`; raíz: `eslint.config.js`, `.prettierrc`, `.prettierignore`, scripts (`lint`, `lint:format`, `typecheck`, `build`); `packages/config/` (`@repo/config`) con `tsconfig/{base,node,nest}.json` (estricto, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, y para Nest `experimentalDecorators`, `emitDecoratorMetadata`, `useDefineForClassFields: false`), `eslint/base.js` (flat config con `typescript-eslint`), `prettier/index.json`. Dependencias de desarrollo en la raíz: `turbo`, `typescript` (5.9.x, D-02), `eslint`, `typescript-eslint`, `prettier`.
- **Entregables:**
  - `turbo.json` con las tareas `build`, `typecheck`, `lint`, `test`, `test:int`, `lint:boundaries` y `dev` (persistente, sin caché), con `inputs`/`outputs` correctos y modo estricto de variables de entorno.
  - Configuración compartida consumida por `packages/config` mismo (lint y typecheck de sus propios archivos).
  - ESLint con regla de imports ordenados y sin `any` implícito; carpeta `generated/` ignorada.
- **Criterios de aceptación:**
  1. `pnpm turbo run lint typecheck build` termina con código 0.
  2. Una segunda ejecución sin cambios reporta caché completa (`FULL TURBO`).
  3. `pnpm lint:format` pasa y falla si se desformatea un archivo.
  4. Un error de tipos deliberado (introducido y luego revertido) hace fallar `typecheck`; evidencia en el reporte.
  5. El hook de formato se comprueba en vivo: se escribe un `.ts` mal formateado y queda formateado.
  6. `turbo run build --dry-run=json` muestra el grafo esperado.
- **Skills / MCPs:** skill `turborepo` (leer `node_modules/turbo/docs/README.md` ya instalado), Context7 (ESLint 10 flat config, typescript-eslint, Turborepo `inputs`/`outputs`).
- **Verificación:**
  ```bash
  pnpm turbo run lint typecheck build
  pnpm turbo run lint typecheck build          # segunda corrida: debe ser cache hit
  pnpm lint:format
  pnpm turbo run build --dry-run=json | jq '.tasks[].taskId'
  ```
- **Checkpoint de revisión humana:** revisar el rigor de los `tsconfig` y el conjunto de reglas de ESLint; confirmar que las tareas de `turbo.json` no declaran `outputs` de más (caché envenenada).
- **Riesgos / decisiones abiertas:** ESLint 10 y typescript-eslint con TypeScript 5.9 (verificar peer); a partir de aquí el hook de ESLint puede bloquear escrituras: la configuración debe ser estable antes de seguir.

#### SUB-FASE 0.3 — Vitest y política de cobertura

- **Objetivo:** un solo ejecutor de pruebas con la política de umbrales del plan, preparado para decoradores de NestJS.
- **Estimación:** 3 h · **Depende de:** 0.2 · **RH:** No · **Diseño previo:** No.
- **Archivos / paquetes / capas:** `packages/config/vitest/{base,node,nest}.ts` (fábrica `createVitestConfig`), con su prueba unitaria `*.spec.ts`; tareas Turbo `test` (unitarias: `src/**/*.spec.ts`) y `test:int` (`test/integration/**/*.int-spec.ts`); dependencias: `vitest`, `@vitest/coverage-v8`, `unplugin-swc`, `@swc/core`.
- **Entregables:**
  - Configuración compartida con tres perfiles: puro (`domain`: 90 % de ramas), Nest (85 % de líneas) y utilidades (80 %), según la tabla "Política de pruebas por módulo, archivo y componente" del plan.
  - Plugin SWC configurado con metadatos de decoradores bajo ESM.
  - Convenciones de nombres de archivos de prueba documentadas en el README de `packages/config`.
- **Criterios de aceptación:**
  1. `pnpm test` ejecuta las pruebas unitarias y termina con código 0.
  2. `pnpm test:int` existe y no falla cuando aún no hay suites (`passWithNoTests`).
  3. La cobertura se calcula y **falla con código distinto de 0** cuando no se alcanza el umbral (evidencia: archivo de prueba temporal con ramas sin cubrir, luego retirado).
  4. Las pruebas unitarias no tocan red ni disco ajeno.
  5. La decisión Vitest 4.x o 5.x queda en el ADR-0001 con la prueba que la respalda.
- **Skills / MCPs:** Context7 (Vitest 5, `unplugin-swc`, cobertura v8). La skill `nestjs-best-practices` (regla `testing-unit-tests`) usa Jest: adaptar a Vitest.
- **Verificación:**
  ```bash
  pnpm test
  pnpm turbo run test -- --coverage
  pnpm test:int
  ```
- **Checkpoint de revisión humana:** confirmar umbrales y que `domain` queda en 90 % de ramas; revisar el perfil Nest.
- **Riesgos / decisiones abiertas:** la prueba real de "SWC + `emitDecoratorMetadata` + ESM + inyección de dependencias de Nest" solo es posible con Nest instalado: queda como criterio explícito de 0.8. Los umbrales "por módulo" del plan se aplican por paquete mientras no existan módulos; si se quiere granularidad por módulo, se decide en 0.14.

#### SUB-FASE 0.4 — Reglas de dependencia ejecutables

- **Objetivo:** convertir `docs/architecture-rules.md` (secciones 1, 2 y 3) en una verificación que rompe el build ante un import prohibido.
- **Estimación:** 5 h · **Depende de:** 0.3, D-05, D-06, D-07 · **RH:** Sí · **Diseño previo:** Sí.
- **Archivos / paquetes / capas:** `packages/config/eslint/boundaries.js`, `packages/config/eslint/boundaries.spec.ts`, tarea Turbo `lint:boundaries`, `docs/adr/0002-herramienta-de-fronteras.md`, `docs/adr/0003-capas-y-ubicacion-de-modulos.md`. Si D-05/D-07 lo exigen, una propuesta de cambio a `docs/architecture-rules.md` (**revisión humana**; el implementador propone, no impone).
- **Entregables:**
  - Mapa de elementos (globs) a tipos: `domain`, `contracts`, `db`, `integrations`, `observability`, `testing`, `config`, `platform`, `api`, `worker`, `provider-sim`, `web`, `ui`, `api-client`.
  - Reglas de la sección 1 (paquetes y apps), sección 2 (capas hexagonales: `application` y `interface` no importan `infrastructure` ni Prisma) y sección 3 (capas FSD de `apps/web`).
  - Pruebas de las reglas con la API de Node de ESLint (`lintText` con rutas virtuales): **al menos una prueba que falla por cada arista prohibida** y una que pasa por cada arista permitida.
  - ADR-0002 (herramienta) y ADR-0003 (capas confirmadas, ubicación de módulos compartidos, módulos técnicos sin cuatro capas).
- **Criterios de aceptación:**
  1. Cada fila "Nunca importa" de la sección 1 tiene una prueba negativa; ídem las prohibiciones de la sección 2 y las de FSD (una app no importa de otra, `web` no importa `db` ni `integrations`, `provider-sim` no importa `db`).
  2. `pnpm lint:boundaries` termina con código 0 sobre el código real y forma parte de `pnpm lint`.
  3. La regla "Prisma solo en `infrastructure/` y `packages/db`" está cubierta por una prueba.
  4. Las reglas de las filas faltantes (D-07) están documentadas en un ADR y aceptadas por el usuario.
  5. El hook de ESLint avisa en vivo al escribir un import prohibido (comprobado una vez).
- **Skills / MCPs:** Context7 (`eslint-plugin-boundaries`, su rango de peer con ESLint 10); `architect-reviewer` para contrastar el mapa contra `architecture-rules.md`.
- **Verificación:**
  ```bash
  pnpm lint:boundaries
  pnpm turbo run test --filter=@repo/config
  pnpm lint
  ```
- **Checkpoint de revisión humana:** comparar fila por fila la tabla de elementos y reglas con `architecture-rules.md`; aprobar o corregir D-05 y D-07; confirmar como firmes las capas hexagonales ("inferido" hoy).
- **Riesgos / decisiones abiertas:** D-05, D-06, D-07. Falsos negativos si un glob no coincide con el paquete real: por eso la prueba negativa por arista. Se vuelve a validar sobre archivos reales en 0.12.

#### SUB-FASE 0.5 — CI base (calidad y secretos)

- **Objetivo:** un pipeline de GitHub Actions que repite los mismos controles que se corren en local y escanea secretos.
- **Estimación:** 3 h · **Depende de:** 0.4, D-04, D-08, P-03 · **RH:** No · **Diseño previo:** No.
- **Archivos / paquetes / capas:** `.github/workflows/ci.yml`, `.github/actions/setup/action.yml` (Node desde `.nvmrc`, pnpm, caché del almacén, `pnpm install --frozen-lockfile`).
- **Entregables:**
  - Jobs: instalar, `lint`, `lint:boundaries`, `typecheck`, `test`, `build`, y escaneo de secretos con gitleaks.
  - En PR: `turbo run ... --affected`; en `main`: ejecución completa. Concurrencia con cancelación, `permissions: contents: read`.
  - Acciones de terceros **fijadas por SHA de commit** (obtener con `git ls-remote`; si no se puede, pedirlo al usuario).
  - Caché remota de Turbo según D-08.
- **Criterios de aceptación:**
  1. El workflow es YAML válido y usa el mismo Node/pnpm que local.
  2. En GitHub, un PR de prueba pasa todos los jobs.
  3. Un PR de prueba con un import prohibido **falla** el job de fronteras (evidencia con enlace o captura).
  4. gitleaks se ejecuta sobre el historial completo del PR.
  5. Ninguna acción usa `@main`, `@master` ni etiquetas móviles.
- **Skills / MCPs:** Context7 (GitHub Actions, `pnpm/action-setup`, `actions/setup-node`, gitleaks-action). El MCP de GitHub está roto (P-04): no depender de él.
- **Verificación:**
  ```bash
  # Local (mismo conjunto que CI)
  pnpm turbo run lint lint:boundaries typecheck test build
  # Remoto: el usuario empuja la rama, abre un PR y revisa los jobs en la pestaña Actions
  ```
- **Checkpoint de revisión humana:** revisar el workflow, los permisos y los SHA fijados; ejecutar el PR de prueba verde y el rojo. Nota: no se puede pasar a **Completada** sin la corrida remota.
- **Riesgos / decisiones abiertas:** P-03 (sin remoto no hay verificación), D-08, tiempo de la primera corrida. El primer push del repositorio es también la primera corrida de gitleaks: confirmar antes que no hay secretos en lo que se sube.

### Bloque B — Infraestructura local

#### SUB-FASE 0.6 — Docker Compose, perfil `infra`

- **Objetivo:** Postgres, Redis y Mailpit sanos con un comando, con los roles de base de datos del diseño.
- **Cambio de alcance (2026-11-18, ADR-0004):** MinIO sale de la 0.6. Su edición comunitaria ya no publica binarios ni imágenes (solo código fuente) y nada en la Fase 0 usa almacenamiento S3. El emulador S3 local se decide en la Fase 3 (candidato: RustFS).
- **Estimación:** 4 h · **Depende de:** 0.1, P-01, D-09 · **RH:** No · **Diseño previo:** Sí (roles, volúmenes, puertos).
- **Archivos / paquetes / capas:** `infra/docker/compose.yaml` (perfil `infra`), `infra/docker/.env.example` (solo valores sintéticos), `infra/docker/postgres/init/` (creación de las bases `fintech` y `provider_sim` y de los roles `owner`, `app` y `readonly`), `infra/docker/README.md`. Scripts de la raíz opcionales: `infra:up`, `infra:down`.
- **Entregables:**
  - Tres servicios con etiqueta y digest de imagen fijos (nunca `latest`), healthchecks propios de cada imagen, volúmenes con nombre y puertos publicados solo en `127.0.0.1`.
  - Redis con persistencia y `maxmemory-policy noeviction` (requisito de BullMQ).
  - Postgres con las dos bases (la del simulador queda vacía hasta la Fase 2) y roles con privilegios mínimos; el rol dueño con `CREATEDB` solo en local (base sombra de `migrate dev`).
- **Criterios de aceptación:**
  1. `docker compose ... config -q` termina con código 0.
  2. `up -d --wait` deja los tres servicios `healthy`.
  3. `pg_isready` responde; `redis-cli ping` devuelve `PONG`; la interfaz de Mailpit responde en localhost. (La comprobación de MinIO sale del alcance: ADR-0004.)
  4. Existen las dos bases y los tres roles; el rol `app` no puede crear tablas.
  5. Los datos de Postgres persisten tras `down` y `up` (sin `-v`).
  6. Ningún secreto real en el repositorio; `.env.example` solo trae valores de desarrollo.
- **Skills / MCPs:** Context7 (especificación de Compose, imágenes oficiales). No hay skill de Docker Compose (ver `SOURCES.md`).
- **Verificación:**
  ```bash
  docker compose -f infra/docker/compose.yaml --env-file infra/docker/.env.example --profile infra config -q
  docker compose -f infra/docker/compose.yaml --env-file infra/docker/.env.example --profile infra up -d --wait
  docker compose -f infra/docker/compose.yaml --env-file infra/docker/.env.example --profile infra ps
  docker compose -f infra/docker/compose.yaml --env-file infra/docker/.env.example exec postgres pg_isready
  docker compose -f infra/docker/compose.yaml --env-file infra/docker/.env.example exec redis redis-cli ping
  curl -sf http://localhost:8025/ > /dev/null && echo "mailpit ok"
  ```
- **Checkpoint de revisión humana:** revisar el modelo de roles y privilegios (es la base del "solo inserción" de 0.15); confirmar versiones de imagen (D-09), puertos y volúmenes; crear tú el `.env` real a partir de `.env.example` si quieres valores propios (el agente no puede).
- **Riesgos / decisiones abiertas:** P-01 y D-09. Conflicto de puertos con servicios de Windows; rendimiento de volúmenes (el repositorio debe seguir en el sistema de archivos de WSL); consumo de memoria de la VM de Docker Desktop. `down -v` borra datos: pedir confirmación.

### Bloque C — Base del backend

#### SUB-FASE 0.7 — Logger y contexto de ejecución (`packages/observability`)

- **Objetivo:** un logger JSON que nunca escribe datos personales y un contexto de ejecución (`request_id`, `correlation_id`, actor, IP) disponible sin pasar parámetros.
- **Estimación:** 3 h · **Depende de:** 0.4 · **RH:** No · **Diseño previo:** No.
- **Archivos / paquetes / capas:** `packages/observability/` (`@repo/observability`): `src/logger/create-logger.ts`, `src/logger/redaction.ts`, `src/context/execution-context.ts` (`AsyncLocalStorage`), y sus `*.spec.ts`. Dependencias: `pino`; `pino-pretty` solo de desarrollo.
- **Entregables:**
  - `createLogger({ service, level, appEnv })` con salida JSON, `pino-pretty` solo en `local`, y `mixin` que agrega `request_id` y `correlation_id` del contexto.
  - Enmascarado (`redact`) de documento, correo, teléfono, contraseñas, tokens, cookies y cabecera `Authorization`, también en objetos anidados y arreglos.
  - Contexto de ejecución con `run(store, fn)` y `get()`; sin dependencia de NestJS.
- **Criterios de aceptación:**
  1. Pruebas que demuestran que ningún valor sensible aparece en la salida serializada (casos anidados y en arreglos).
  2. El `request_id` aparece en cada línea emitida dentro de un contexto y no se mezcla entre ejecuciones concurrentes (prueba con dos promesas en paralelo).
  3. Cobertura de ramas >= 85 %.
  4. `observability` no importa `domain`, `db`, NestJS ni apps (verificado por `lint:boundaries`).
- **Skills / MCPs:** Context7 (pino 10: `redact`, `mixin`), skill `nestjs-best-practices` (reglas `error-handling-structured-logging` y `error-handling-logger-context`).
- **Verificación:**
  ```bash
  pnpm turbo run lint typecheck test --filter=@repo/observability
  pnpm lint:boundaries
  ```
- **Checkpoint de revisión humana:** revisar la lista de claves enmascaradas contra el plan (documento, correo, teléfono, tokens); proponer claves adicionales propias del dominio. Candidatas desde la v2 del plan maestro, a decidir aquí: ingreso y datos del hogar, identificador del producto de ahorro y llave Bre-B del dueño.
- **Riesgos / decisiones abiertas:** el enmascarado por nombre de clave no atrapa datos personales en cadenas libres; se documenta como límite conocido.

#### SUB-FASE 0.8 — `apps/api` base: configuración, `/health` y endurecimiento HTTP

- **Objetivo:** una aplicación NestJS mínima, configurable y probada, que es la plantilla de las demás.
- **Estimación:** 4 h · **Depende de:** 0.7, D-10 · **RH:** No · **Diseño previo:** No.
- **Archivos / paquetes / capas:** `apps/api/` (`@repo/api`): `src/main.ts` (función `createApp()` separada de `listen`), `src/app.module.ts`, `src/config/` (esquema Zod de entorno), `src/health/` (`GET /health`), `test/e2e/*.e2e-spec.ts`, `apps/api/.env.example`, `apps/api/CLAUDE.md` (propuesta, revisión humana). Dependencias: `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/config`, `reflect-metadata`, `rxjs`, `zod`, `helmet`, `supertest` (desarrollo).
- **Entregables:**
  - Validación de entorno con Zod: arranca solo si todo es válido, con mensajes que no imprimen valores; incluye `APP_ENV` con los ambientes del plan.
  - `helmet` primero, CORS con lista blanca de orígenes (nunca `*`), tamaño máximo de cuerpo, `trust proxy` configurable, cierre ordenado (`enableShutdownHooks`).
  - Versionado `/v1` con `/health` fuera del prefijo; `/health` responde sin tocar dependencias (vivacidad).
  - Logger de 0.7 integrado como logger de Nest.
- **Criterios de aceptación:**
  1. Una prueba de integración con `Test.createTestingModule` resuelve inyección de dependencias por **metadatos de decoradores bajo ESM + SWC** (cierra el riesgo abierto en 0.3).
  2. `GET /health` devuelve 200 con Supertest; la cabecera `x-powered-by` está ausente y las cabeceras de `helmet` presentes.
  3. CORS permite un origen de la lista y rechaza otro.
  4. Arrancar con una variable inválida o ausente falla con un mensaje claro y código distinto de 0.
  5. `SIGTERM` cierra la app sin dejar conexiones abiertas.
  6. Cobertura de líneas >= 85 %.
- **Skills / MCPs:** `nestjs-best-practices` (reglas `security-helmet-headers`, `security-cors-whitelist`, `config-no-secrets`, `deployment-health-checks`; ignorar lo de Bun), Context7 (NestJS 12: bootstrap ESM, `@nestjs/config`).
- **Verificación:**
  ```bash
  pnpm turbo run lint typecheck test --filter=@repo/api
  pnpm turbo run dev --filter=@repo/api &   # en otra terminal
  curl -s -i http://localhost:3000/health
  pnpm lint:boundaries
  ```
- **Checkpoint de revisión humana:** revisar las cabeceras de seguridad, la lista de variables de entorno y el contenido del `apps/api/CLAUDE.md` propuesto.
- **Riesgos / decisiones abiertas:** D-10. Compatibilidad real de `@nestjs/config` y `reflect-metadata` con Nest 12 en ESM. La herramienta de compilación y de recarga (por ejemplo `nest start --watch`, `tsx watch` o `swc`) se elige aquí y se registra en un ADR, porque `docker compose watch` (0.24) depende de ella.

#### SUB-FASE 0.9 — Contexto de petición y errores RFC 9457

- **Objetivo:** que cada petición tenga identificadores trazables y que todo error salga con el mismo formato público, sin filtrar internos.
- **Estimación:** 4 h · **Depende de:** 0.8, D-11 · **RH:** No · **Diseño previo:** Sí (forma del cuerpo de error y estrategia de mapeo).
- **Archivos / paquetes / capas:** `packages/contracts/` (`@repo/contracts`, solo depende de `zod`): `src/errors/problem-details.ts`; `apps/api/src/common/http/` con `request-context.middleware.ts`, `all-exceptions.filter.ts`, `zod-validation.pipe.ts` (nestjs-zod); pruebas unitarias y e2e con un controlador **solo de pruebas** (no se envía código de demostración en producción).
- **Entregables:**
  - Esquema `ProblemDetails` (RFC 9457) con las extensiones `code`, `details` y `request_id`, `Content-Type: application/problem+json`.
  - Middleware que acepta un `X-Request-Id` válido o genera uno (UUID), lo devuelve en la respuesta, y llena el contexto de 0.7 (IP, agente de usuario, `correlation_id`).
  - Filtro global: mapea `HttpException`, errores de validación (400 con `details` por campo), 404 y excepciones desconocidas (500 genérico, sin traza ni mensaje interno), y registra el error con su `request_id`.
  - Validación global con `nestjs-zod` usando los mismos esquemas de `contracts`.
- **Criterios de aceptación:**
  1. Pruebas e2e: 404, validación (400 con detalles por campo), excepción no controlada (500 sin fuga de datos) y excepción de dominio.
  2. El `request_id` de la respuesta coincide con el del registro del error; un `X-Request-Id` inválido se reemplaza.
  3. Dos peticiones concurrentes no mezclan contexto.
  4. `contracts` no importa nada salvo `zod` (verificado por `lint:boundaries`).
  5. El formato de error queda documentado y aprobado (D-11).
- **Skills / MCPs:** `nestjs-best-practices` (`error-handling-exception-filter`, `validation-dto-validation`), Context7 (`nestjs-zod` con Zod 4 y Nest 12, RFC 9457).
- **Verificación:**
  ```bash
  pnpm turbo run lint typecheck test --filter=@repo/api --filter=@repo/contracts
  pnpm lint:boundaries
  ```
- **Checkpoint de revisión humana:** aprobar el formato público de error (es un contrato con el frontend y los proveedores); revisar que ningún mensaje de excepción interna llegue al cliente.
- **Riesgos / decisiones abiertas:** D-11. Compatibilidad `nestjs-zod` 5.x con Zod 4 y Nest 12: si no existe, proponer alternativa en el diseño previo.

### Bloque D — Persistencia

#### SUB-FASE 0.10 — Prisma 7 en `packages/db`

- **Objetivo:** Prisma 7 operativo contra el Postgres de Docker, con el cliente generado dentro del grafo de Turbo y el MCP de Prisma funcionando; sin tablas todavía.
- **Estimación:** 4 h · **Depende de:** 0.6, 0.2, D-12 · **RH:** Sí · **Diseño previo:** Sí (ubicación de la config y del cliente generado).
- **Archivos / paquetes / capas:** `prisma.config.ts` (raíz o `packages/db`, D-12), `packages/db/` (`@repo/db`): `prisma/schema.prisma` (generador `prisma-client` con `output` propio, fuente `postgresql`), `prisma/seed.ts` (idempotente, sin datos de negocio), `src/client.ts` (`createPrismaClient({ connectionString })` con `@prisma/adapter-pg`), `src/index.ts`. Raíz: `prisma@7.10.1` exacto como dependencia de desarrollo. Turbo: tarea `db:generate` (entradas: el esquema; salidas: el cliente) como dependencia de `typecheck`, `build` y `test` de los paquetes que usan `db`. `docs/adr/0009-convenciones-de-datos.md` (antes 0004, ya ocupado). ESLint y tsconfig ignoran el cliente generado.
- **Entregables:**
  - Convenciones de datos del plan en el ADR-0009 (el plan decía ADR-0004, ya ocupado por la infraestructura local; corregido el 2026-11-19) (UUIDv7, `BigInt` para dinero, `Timestamptz` UTC, `snake_case` con `@@map`, índices parciales por SQL en la migración).
  - Flujo de migraciones documentado (`--create-only`, revisión, aplicación).
  - Comprobación del MCP `prisma-local` contra la base de Docker (solo `migrate-status`).
- **Criterios de aceptación:**
  1. `pnpm prisma validate` y `pnpm prisma generate` terminan con código 0.
  2. `pnpm prisma migrate status` conecta a la base de Docker y reporta que no hay migraciones.
  3. La herramienta `migrate-status` del MCP `prisma-local` responde contra el mismo Postgres (si el MCP no encuentra la config, documentar la solución; cambiar `.mcp.json` requiere revisión humana).
  4. `pnpm turbo run typecheck build` compila `db` con el cliente generado, y el cliente generado no está versionado (`git check-ignore`).
  5. La versión de `prisma` en el lockfile es exactamente `7.10.1` (no la 8 RC).
- **Skills / MCPs:** skills `prisma-cli` y `prisma-client-api` (leer `references/agent-safety.md`); Context7 (Prisma 7: generador `prisma-client`, `prisma.config.ts`, adaptador `pg`); MCP `prisma-local` (solo lectura).
- **Verificación:**
  ```bash
  pnpm prisma validate
  pnpm prisma generate
  pnpm prisma migrate status
  pnpm turbo run typecheck build --filter=@repo/db
  git check-ignore -v packages/db/src/generated/prisma/client.ts
  ```
- **Checkpoint de revisión humana:** revisar el ADR-0009 (convenciones que todos los modelos heredarán); confirmar que `package.json` fija `prisma` exacto; verificar que el MCP no apunta a nada que no sea Docker.
- **Riesgos / decisiones abiertas:** D-12. La etiqueta `latest` de `prisma` en npm es hoy un RC de la 8. Importación del cliente generado bajo `Node16` (extensiones `.js`). Para Prisma 7 el `datasource.url` vive en la config y no en el esquema. `prisma.config.ts` carga `dotenv`: eso lee el `.env` del usuario en tiempo de ejecución, no el agente.

#### SUB-FASE 0.11 — Harness de pruebas de integración (`packages/testing`)

- **Objetivo:** pruebas contra Postgres y Redis reales y desechables, reutilizables por todos los módulos.
- **Estimación:** 4 h · **Depende de:** 0.10, 0.3, P-01 · **RH:** No · **Diseño previo:** No.
- **Archivos / paquetes / capas:** `packages/testing/` (`@repo/testing`): `src/containers/{postgres,redis}.ts`, `src/vitest/global-setup.ts`, `src/db/{migrate,reset}.ts`, `src/clock/manual-clock.ts` (reloj manual para pruebas). Una suite de humo `test/integration/harness.int-spec.ts`. Perfil `test:int` en `@repo/config`. Dependencias: `testcontainers`, `@testcontainers/postgresql`, `@testcontainers/redis`, `ioredis`.
- **Entregables:**
  - Arranque de Postgres (misma versión mayor que local, D-09) y Redis por suite; aplicación de las migraciones existentes sobre la base vacía; aislamiento entre pruebas (limpieza o reversión por transacción).
  - Utilidad para crear el cliente Prisma contra el contenedor.
  - Documentación de cómo escribir una `*.int-spec.ts`.
- **Criterios de aceptación:**
  1. `pnpm test:int` arranca contenedores, ejecuta la suite de humo (`SELECT 1` con Prisma y `PING` de Redis) y los destruye.
  2. Tras la corrida no quedan contenedores de Testcontainers.
  3. El tiempo de arranque queda medido y registrado en el reporte.
  4. Las pruebas no usan el Postgres de Compose ni red externa.
- **Skills / MCPs:** Context7 (Testcontainers para Node, módulo Postgres/Redis). No existe skill de Testcontainers.
- **Verificación:**
  ```bash
  pnpm test:int
  docker ps --filter label=org.testcontainers=true      # pide confirmación; debe salir vacío
  ```
- **Checkpoint de revisión humana:** decidir cómo se aplican las migraciones en el harness. Opciones: leer y aplicar los `migration.sql` directamente, o ejecutar `prisma migrate deploy` por programa **solo contra el contenedor desechable**. Esta última tiene un matiz de política ("deploy solo en CI/migrator"): pedir tu criterio.
- **Riesgos / decisiones abiertas:** P-01. Ryuk (el reaper de Testcontainers) en Docker Desktop con WSL. Tiempo de arranque en CI.

#### SUB-FASE 0.12 — `ClockService`

- **Objetivo:** la única fuente de hora del backend, con un reloj controlable para simulación y una regla de lint que prohíbe leer la hora del sistema en otro lugar.
- **Estimación:** 3 h · **Depende de:** 0.8, 0.11, D-13 · **RH:** No · **Diseño previo:** No.
- **Archivos / paquetes / capas:** `packages/domain/` (`@repo/domain`, se crea aquí): `src/clock/clock.ts` (puerto `Clock { now(): Date }`, solo tipos). `{PLATFORM}` (`packages/platform/`, se crea aquí si D-05 = A): `clock/{clock.module.ts, system.clock.ts, controllable.clock.ts, tokens.ts}` y sus pruebas. `packages/config/eslint/`: regla `no-restricted-properties`/`no-restricted-syntax` contra `Date.now()` y `new Date()` sin argumentos, con excepción solo para `system.clock.ts`; pruebas de la regla. Dependencias: `ioredis` en `platform`.
- **Entregables:**
  - `SystemClock` (producción) y `ControllableClock` respaldado en Redis (`now`, `set`, `advance(ms)`), seleccionados por `CLOCK_MODE` (`system|controllable`); el modo `controllable` **no se puede activar con `APP_ENV=production`** (la app falla al arrancar).
  - Regla de lint con pruebas; el reloj manual de `packages/testing` (de 0.11) se usa en las pruebas.
  - Nota de diseño: los `DEFAULT now()` de la base no sustituyen al reloj.
- **Criterios de aceptación:**
  1. Pruebas unitarias de ambos relojes y de la selección por entorno.
  2. Prueba de integración (Redis real) donde dos instancias de la app ven el mismo instante controlado.
  3. La regla de lint falla ante `Date.now()` y `new Date()` fuera del reloj y no ante `new Date(valor)`.
  4. `domain` sigue sin dependencias externas (`lint:boundaries` en verde), ahora comprobado con archivos reales.
  5. Cobertura de `platform/clock` >= 85 % de líneas.
- **Skills / MCPs:** Context7 (ioredis 6), `nestjs-best-practices` (módulos de funcionalidad, inyección por token). `architect-reviewer` sobre el alcance.
- **Verificación:**
  ```bash
  pnpm turbo run lint typecheck test --filter=@repo/domain --filter=@repo/platform
  pnpm test:int
  pnpm lint:boundaries
  ```
- **Checkpoint de revisión humana:** aprobar el alcance del reloj controlable (D-13) y la excepción de la regla de lint; confirmar el nombre de paquete `platform`.
- **Riesgos / decisiones abiertas:** D-13 y D-05. El reloj controlable alterará los tiempos de reintento y expiración (relevo del `outbox`, llaves de idempotencia): hay que usarlo siempre, no `setTimeout` con aritmética de fechas.

#### SUB-FASE 0.13 — `PrismaService` y `UnitOfWork`

- **Objetivo:** que los casos de uso puedan agrupar escrituras en una transacción sin conocer Prisma, y que `audit` y `outbox` se unan a esa misma transacción.
- **Estimación:** 5 h · **Depende de:** 0.9, 0.11, 0.12 · **RH:** Sí (base del `ledger`) · **Diseño previo:** Sí.
- **Archivos / paquetes / capas:** `packages/domain/src/ports/unit-of-work.ts` (puerto); `{PLATFORM}/persistence/`: `prisma.module.ts`, `prisma.service.ts` (cliente con adaptador `pg`, ciclo de vida), `transaction-context.ts` (`AsyncLocalStorage` con el cliente de la transacción activa), `prisma-unit-of-work.ts`, `current-client.ts`; `apps/api/src/health/` gana `GET /health/ready` (base de datos y Redis). Pruebas unitarias e `*.int-spec.ts`.
- **Entregables:**
  - Puerto `UnitOfWork.run(fn, options?)` con nivel de aislamiento configurable, tiempo máximo y reintento acotado ante fallos de serialización (SQLSTATE `40001`).
  - Un `run` anidado se une a la transacción activa; fuera de un `run`, los repositorios usan el cliente raíz.
  - API para que `audit` y `outbox` obtengan el cliente actual y para saber si hay una transacción activa.
  - Sondeo de preparación (`/health/ready`).
- **Criterios de aceptación:**
  1. Dos escrituras de repositorios distintos dentro de un `run` se confirman juntas; si la segunda falla, ninguna queda (prueba de integración).
  2. `run` anidado reutiliza la transacción; peticiones concurrentes no comparten contexto transaccional.
  3. El reintento por `40001` se limita y se registra; los errores de negocio no se reintentan.
  4. `application/` y `interface/` no importan Prisma (`lint:boundaries` en verde con código real).
  5. `/health/ready` devuelve 503 cuando Postgres o Redis no responden (prueba apagando el contenedor).
  6. Cobertura >= 85 % en líneas.
- **Skills / MCPs:** `prisma-client-api` (referencia `transactions.md`), `nestjs-best-practices` (`database-repository-pattern`), Context7 (Prisma 7: transacciones interactivas, `AsyncLocalStorage`). `architect-reviewer`.
- **Verificación:**
  ```bash
  pnpm turbo run lint typecheck test --filter=@repo/platform --filter=@repo/domain
  pnpm test:int
  pnpm lint:boundaries
  ```
- **Checkpoint de revisión humana:** revisar con cuidado el diseño de aislamiento y reintentos: de esto depende la integridad del ledger. Aprobar el diseño antes de que `audit` y `outbox` lo usen.
- **Riesgos / decisiones abiertas:** la propagación por `AsyncLocalStorage` falla si algún código crea hilos o promesas fuera de contexto; el timeout de transacción interactiva de Prisma; pérdida de contexto en consumidores de colas (se cubre en 0.18).

### Bloque E — Convenciones y módulos transversales

#### SUB-FASE 0.14 — Skills propias y `test-writer` (versión corta)

- **Objetivo:** fijar en skills lo ya aprendido en 0.12 y 0.13, para que los módulos siguientes (y las fases 1 a 5) nazcan con las mismas capas y pruebas.
- **Estimación:** 4 h · **Depende de:** 0.12, 0.13, D-14 · **RH:** Sí (cambia `.claude/**`) · **Diseño previo:** No.
- **Archivos / paquetes / capas:** `.claude/skills/nest-module-scaffold/` (`SKILL.md` corto + `rules/*.md`), `.claude/skills/testing-policy/` (`SKILL.md` + tabla de pruebas por tipo de archivo y umbrales), `.claude/agents/test-writer.md`, `.claude/skills/SOURCES.md` (procedencia de las skills propias), `apps/api/CLAUDE.md` si no se hizo en 0.8.
- **Entregables:**
  - `nest-module-scaffold`: capas `domain`, `application`, `infrastructure` e `interface`; reglas de importación; plantilla de pruebas por archivo; cómo registrar `audit` y `outbox`; cuándo un módulo no lleva las cuatro capas; ubicación según D-05.
  - `testing-policy`: la tabla de pruebas del plan por tipo de archivo, umbrales y convenciones de nombres; Vitest y no Jest.
  - `test-writer`: subagente que escribe las pruebas que exige la política para el cambio actual.
  - Un caso de prueba manual por skill (prompt de ejemplo y resultado esperado), como pide el documento de Skills.
- **Criterios de aceptación:**
  1. La descripción (`description`) de cada skill enumera frases concretas que la activan.
  2. Prueba de humo: pedir a un agente nuevo que cree un módulo de ejemplo **en un directorio temporal fuera del workspace**; respeta las capas, trae sus `*.spec.ts` y `architect-reviewer` no reporta hallazgos. Se elimina el ejemplo.
  3. El `SKILL.md` es un índice corto; el detalle está en `rules/`.
  4. Ninguna skill descarga instrucciones ni ejecutables de internet; la procedencia queda en `SOURCES.md`.
- **Skills / MCPs:** skill global `anthropic-skills:skill-creator` (la copia del proyecto se retiró, ver `SOURCES.md`); `bambu-nest-test` solo como inspiración (decisión de `SOURCES.md`).
- **Verificación:** la prueba de humo del criterio 2, ejecutada con el subagente y registrada en el reporte; `pnpm lint:format` sobre los Markdown que corresponda.
- **Checkpoint de revisión humana:** leer cada `SKILL.md` y `test-writer.md` completos (son instrucciones que Claude seguirá como propias); decidir si `test-writer` puede quedar con escritura general, ya que un subagente no hereda hooks ni permisos y no se puede limitar por ruta.
- **Riesgos / decisiones abiertas:** D-14. Las skills se refinan en cada fase; esta es la versión mínima útil.

#### SUB-FASE 0.15 — Módulo `audit` y primera migración

- **Objetivo:** un registro inmutable de toda acción (quién, qué, cuándo, desde dónde) que se escribe dentro de la transacción del caso de uso.
- **Estimación:** 6 h · **Depende de:** 0.13, 0.14, D-15 · **RH:** Sí (migración y auditoría) · **Diseño previo:** Sí.
- **Archivos / paquetes / capas:** `packages/db/prisma/schema.prisma` (modelo `AuditLog` → tabla `audit_log`) y `packages/db/prisma/migrations/<fecha>_audit_log/migration.sql` (SQL manual dentro de la migración); `{PLATFORM}/audit/` con `domain/` (entrada de auditoría, convención `modulo.accion`, política de enmascarado), `application/` (`RecordAuditEntry`, puerto del repositorio), `infrastructure/` (repositorio Prisma que usa el cliente de la transacción activa); pruebas unitarias e integración. Sin `interface/` en la Fase 0.
- **Entregables:**
  - Tabla `audit_log`: `id` (UUIDv7), `occurred_at` (de `Clock`), `actor_type`, `actor_id`, `action`, `resource_type`, `resource_id`, `before`/`after` (JSON ya enmascarado), `ip`, `user_agent`, `request_id`, `correlation_id`; índices por recurso, actor y `request_id`.
  - **Inmutabilidad en dos capas:** `REVOKE UPDATE, DELETE, TRUNCATE` al rol `app` y un trigger `BEFORE UPDATE OR DELETE OR TRUNCATE` que lanza excepción (los permisos solos no frenan al dueño de la tabla); `app` solo tiene `INSERT` y `SELECT`.
  - Servicio de auditoría que toma el contexto de la petición (0.9) y se une a la transacción activa; enmascara documento, correo y teléfono antes de guardar.
  - Primera migración aplicada en el Postgres de Docker.
- **Criterios de aceptación:**
  1. La migración se aplica desde una base vacía (prueba de integración con el harness) y en la base de Docker.
  2. `UPDATE`, `DELETE` y `TRUNCATE` sobre `audit_log` fallan, tanto con el rol `app` como con el rol dueño.
  3. Si la transacción del caso de uso revierte, no queda fila de auditoría; si confirma, queda exactamente una.
  4. `occurred_at` proviene del reloj inyectado (prueba con el reloj manual).
  5. Ningún dato personal sin enmascarar en `before`/`after` (prueba con claves sensibles).
  6. `pnpm prisma migrate status` reporta la base al día; `architect-reviewer` sin hallazgos.
  7. Cobertura de `audit` >= 85 % de líneas.
- **Skills / MCPs:** `prisma-cli`, `prisma-client-api`, `nest-module-scaffold` y `testing-policy` (0.14), `nestjs-best-practices`; MCP `prisma-local` solo para `migrate-status`.
- **Verificación:**
  ```bash
  pnpm prisma validate
  pnpm prisma migrate dev --create-only --name audit_log   # revisar y completar migration.sql; pide confirmación
  pnpm prisma migrate dev                                  # aplica; pide confirmación
  pnpm prisma migrate status
  pnpm turbo run lint typecheck test --filter=@repo/platform --filter=@repo/db
  pnpm test:int
  pnpm lint:boundaries
  ```
- **Checkpoint de revisión humana:** revisión **obligatoria** del `migration.sql` línea por línea (privilegios, trigger, índices), del esquema Prisma y de la política de enmascarado. No hacer `git add` de la migración hasta aprobarla.
- **Riesgos / decisiones abiertas:** D-09 (roles) y D-15. Una vez aplicada y versionada, la migración es inmutable. `ip` como `inet` exige `@db.Inet`. Retención y particionamiento por mes se difieren a escala. El `before`/`after` puede filtrar datos si un llamador pasa objetos sin pasar por el enmascarado.

#### SUB-FASE 0.16 — Módulo `outbox` (lado de escritura)

- **Objetivo:** que los eventos de dominio se guarden en la misma transacción que el cambio de estado, sin perderse ni publicarse desde una transacción fallida.
- **Estimación:** 5 h · **Depende de:** 0.15 · **RH:** Sí · **Diseño previo:** Sí.
- **Archivos / paquetes / capas:** `packages/domain/src/events/domain-event.ts`; `packages/db/prisma/schema.prisma` (modelo `Outbox`) y la migración `<fecha>_outbox` (índice parcial y trigger en SQL); `{PLATFORM}/outbox/` (`domain/`, `application/` con `EnqueueDomainEvent`, `infrastructure/` con el repositorio Prisma); pruebas.
- **Entregables:**
  - Tabla `outbox`: `id` (UUIDv7), `aggregate_type`, `aggregate_id`, `event_type`, `event_version`, `payload` (JSON), `headers` (`request_id`, `correlation_id`), `occurred_at` (de `Clock`), `status`, `attempts`, `next_attempt_at`, `published_at`, `last_error`.
  - Índice **parcial** sobre eventos no publicados, creado por SQL en la migración.
  - Trigger que impide modificar las columnas del evento (`payload`, `event_type`, etc.) y permite solo las de entrega (D-15).
  - `enqueue(event)` que **falla si no hay transacción activa** (garantiza la atomicidad) y serializa `bigint` como cadena (JSON no admite `BigInt`).
- **Criterios de aceptación:**
  1. Un evento encolado dentro de `UnitOfWork.run` existe tras confirmar; si se revierte, no existe.
  2. `enqueue` fuera de una transacción lanza un error explícito.
  3. Un evento con `bigint` se serializa sin pérdida y se recupera idéntico.
  4. Modificar `payload` falla; actualizar `status`/`attempts` funciona.
  5. La migración se aplica desde cero y `migrate status` queda al día.
  6. Cobertura >= 85 % de líneas; `architect-reviewer` sin hallazgos.
- **Skills / MCPs:** igual que 0.15; `nestjs-best-practices` (`architecture-event-driven`).
- **Verificación:**
  ```bash
  pnpm prisma migrate dev --create-only --name outbox      # revisar SQL; pide confirmación
  pnpm prisma migrate dev                                  # pide confirmación
  pnpm prisma migrate status
  pnpm turbo run lint typecheck test --filter=@repo/platform --filter=@repo/domain
  pnpm test:int
  ```
- **Checkpoint de revisión humana:** revisar el SQL de la migración y el contrato del evento (nombre, versión, cabeceras) que usarán todos los módulos; confirmar la política de columnas mutables (D-15).
- **Riesgos / decisiones abiertas:** D-15. La entrega es "al menos una vez": los consumidores deben ser idempotentes. El plan habla de eventos inmutables, pero el estado de entrega necesita actualizarse: se documenta la excepción y el trigger.

#### SUB-FASE 0.17 — Módulo `idempotency`

- **Objetivo:** que repetir una petición `POST` que crea o mueve algo produzca exactamente el mismo resultado, y que ningún endpoint de este tipo pueda olvidar la llave.
- **Estimación:** 6 h · **Depende de:** 0.16, 0.9 · **RH:** Sí (toca la lógica de dinero) · **Diseño previo:** Sí.
- **Archivos / paquetes / capas:** `packages/db/prisma/schema.prisma` (modelo `IdempotencyKey`) y la migración `<fecha>_idempotency_keys`; `{PLATFORM}/idempotency/` (`domain/`, `application/`, `infrastructure/`, `interface/` con el interceptor y los decoradores `@Idempotent()` y `@NotIdempotent(motivo)`); prueba de arquitectura que recorre los controladores.
- **Entregables:**
  - Tabla `idempotency_keys`: `scope` (usuario o anónimo + ruta), `key`, `request_fingerprint` (hash de método, ruta y cuerpo), `status` (`in_progress|completed`), respuesta guardada, `locked_until`, `expires_at`; restricción única `(scope, key)`.
  - Interceptor: sin cabecera `Idempotency-Key` válida devuelve 400 (`ProblemDetails`); misma llave y misma huella con respuesta guardada devuelve la misma respuesta (cabecera `Idempotency-Replayed`); misma llave con otra huella devuelve 422; llave en curso devuelve 409 con `Retry-After`; un fallo del manejador libera la llave para reintentar.
  - **Prueba de arquitectura:** todo manejador `POST`, `PUT`, `PATCH` o `DELETE` debe declarar `@Idempotent()` o `@NotIdempotent(motivo)`; el verificador mismo se prueba con controladores de ejemplo (solo de pruebas).
- **Criterios de aceptación:**
  1. Repetición idéntica devuelve la respuesta original sin volver a ejecutar el manejador (el contador de ejecuciones sigue en 1).
  2. Dos peticiones simultáneas con la misma llave: una ejecuta, la otra recibe 409 (prueba de concurrencia real contra Postgres).
  3. Huella distinta con la misma llave: 422. Llaves de usuarios distintos no chocan.
  4. Una llave expirada permite una nueva ejecución.
  5. La migración se aplica desde cero; `architect-reviewer` sin hallazgos.
  6. La prueba de arquitectura falla ante un `POST` sin anotación (comprobado con un controlador de ejemplo).
  7. Cobertura >= 85 % de líneas.
- **Skills / MCPs:** igual que 0.15; `nestjs-best-practices` (`validation-custom-pipes`, `architecture-thin-controllers`).
- **Verificación:**
  ```bash
  pnpm prisma migrate dev --create-only --name idempotency_keys   # revisar SQL; pide confirmación
  pnpm prisma migrate dev                                         # pide confirmación
  pnpm prisma migrate status
  pnpm turbo run lint typecheck test --filter=@repo/platform
  pnpm test:int
  ```
- **Checkpoint de revisión humana:** aprobar la política de qué se guarda (¿respuestas 4xx? ¿5xx?), el tiempo de vida de la llave y si la reserva de la llave y el cambio de negocio van en la misma transacción o en dos. Revisar el SQL de la migración.
- **Riesgos / decisiones abiertas:** trade-off de atomicidad (llave y negocio en una sola transacción evita perder la respuesta pero alarga el bloqueo). La purga de llaves vencidas queda como tarea del worker (Fase 1 o 2).

### Bloque F — Worker y simulador

#### SUB-FASE 0.18 — `apps/worker` base con BullMQ

- **Objetivo:** un proceso NestJS sin puerto público que consume colas con reintentos y apagado ordenado.
- **Estimación:** 4 h · **Depende de:** 0.12, 0.7 · **RH:** No · **Diseño previo:** No.
- **Archivos / paquetes / capas:** `apps/worker/` (`@repo/worker`): `src/main.ts` (contexto de aplicación independiente), `src/app.module.ts`, `src/config/`, `src/queues/` (conexión y registro de colas), `src/health/` (latido en Redis para el `HEALTHCHECK`); `{PLATFORM}/queue/` (utilidad de procesador base con contexto de ejecución, registro y política de reintentos). Dependencias: `bullmq`, `@nestjs/bullmq`, `ioredis`.
- **Entregables:**
  - Arranque como aplicación independiente (sin servidor HTTP), con configuración validada y logger de 0.7.
  - Procesador base: abre un contexto de ejecución por tarea (`job.id` como `correlation_id`), reintento con espera exponencial, registro uniforme de fallos.
  - Apagado ordenado ante `SIGTERM` (termina la tarea en curso y cierra la conexión) y latido de salud.
- **Criterios de aceptación:**
  1. Prueba de integración (Redis real): una tarea de ejemplo (solo de pruebas) se procesa, se reintenta ante fallo con la espera configurada y falla definitivamente tras el máximo.
  2. Ejecutar la misma tarea dos veces no duplica efectos (patrón de idempotencia de la tarea).
  3. Con `SIGTERM` durante una tarea, el proceso termina limpio.
  4. La hora de reintento sale de `ClockService`.
  5. `worker` no importa `api`, `web` ni `ui` (`lint:boundaries`).
- **Skills / MCPs:** Context7 (BullMQ 6, `@nestjs/bullmq` con Nest 12), `nestjs-best-practices` (`advanced-scheduled-tasks`, solo como referencia), `nest-module-scaffold`.
- **Verificación:**
  ```bash
  pnpm turbo run lint typecheck test --filter=@repo/worker --filter=@repo/platform
  pnpm test:int
  pnpm lint:boundaries
  ```
- **Checkpoint de revisión humana:** revisar la política de reintentos por defecto y el comportamiento al apagar.
- **Riesgos / decisiones abiertas:** compatibilidad de `@nestjs/bullmq` con Nest 12 y BullMQ 6 (si no existe, usar BullMQ directo). Pérdida del contexto de ejecución al entrar a procesadores de BullMQ.

#### SUB-FASE 0.19 — Relevo del `outbox` en el worker

- **Objetivo:** publicar a la cola los eventos guardados en `outbox`, sin perder ninguno y sin duplicar de forma dañina.
- **Estimación:** 5 h · **Depende de:** 0.16, 0.18 · **RH:** Sí · **Diseño previo:** Sí.
- **Archivos / paquetes / capas:** `{PLATFORM}/outbox/` (caso de uso `PublishPendingEvents`, repositorio con consulta de lote, publicador a BullMQ); `apps/worker/src/outbox/` (consumidor/planificador del relevo); pruebas.
- **Entregables:**
  - Lectura de lotes con `SELECT ... FOR UPDATE SKIP LOCKED` ordenados, publicación a la cola `domain-events` con `jobId` igual al id del `outbox` (deduplicación en BullMQ) y marca de publicado.
  - Reintento con espera exponencial según `Clock`; tras el máximo de intentos el evento queda `failed` con su error y se registra un aviso (la tabla `jobs_dead_letter` se difiere, D-15).
  - Parametrización: tamaño de lote e intervalo.
- **Criterios de aceptación:**
  1. Un evento confirmado en `outbox` aparece una vez en la cola.
  2. Dos instancias del relevo en paralelo no publican el mismo evento dos veces.
  3. Si el proceso cae entre publicar y marcar, el evento se vuelve a publicar con el mismo `jobId` y la cola no lo duplica (entrega al menos una vez, documentada).
  4. Un fallo del publicador aplica reintento con espera y llega a `failed` al agotar intentos.
  5. Con el reloj manual se avanza el tiempo y se comprueba el reintento sin esperas reales.
  6. Cobertura >= 85 % de líneas; `architect-reviewer` sin hallazgos.
- **Skills / MCPs:** `prisma-client-api` (`$queryRaw` parametrizado y `SKIP LOCKED`), Context7 (BullMQ: `jobId`, deduplicación).
- **Verificación:**
  ```bash
  pnpm turbo run lint typecheck test --filter=@repo/worker --filter=@repo/platform
  pnpm test:int
  pnpm lint:boundaries
  ```
- **Checkpoint de revisión humana:** revisar la consulta con `SKIP LOCKED` (SQL crudo sobre la tabla de eventos) y el contrato de entrega al menos una vez.
- **Riesgos / decisiones abiertas:** D-15. Consumidores futuros deben ser idempotentes. SQL crudo debe ser parametrizado (regla `database-parameterized-queries`).

#### SUB-FASE 0.20 — `apps/provider-sim` base

- **Objetivo:** el esqueleto del simulador, que ya forma parte de `pnpm dev`, con la garantía de que no arranca en producción.
- **Estimación:** 3 h · **Depende de:** 0.8 · **RH:** No · **Diseño previo:** No.
- **Archivos / paquetes / capas:** `apps/provider-sim/` (`@repo/provider-sim`): `src/main.ts`, `src/app.module.ts`, `src/config/`, `src/health/`, pruebas e2e. Sin Prisma ni `@repo/db`.
- **Entregables:**
  - Misma plantilla que `api` (configuración Zod, logger, `/health`, cierre ordenado) con su propio puerto y variable `PROVIDER_SIM_DATABASE_URL` (declarada, sin usar todavía).
  - **Guardia de producción:** con `APP_ENV=production` el proceso se niega a arrancar con un mensaje claro.
  - Documentación en el README de la app de lo que llega en la Fase 2.
- **Criterios de aceptación:**
  1. `GET /health` devuelve 200.
  2. Arrancar con `APP_ENV=production` falla (prueba automática).
  3. `provider-sim` no importa `db` ni otras apps (`lint:boundaries`).
  4. `api` y `worker` no importan `provider-sim`.
- **Skills / MCPs:** `nest-module-scaffold`, Context7 (si cambia algo respecto a `api`).
- **Verificación:**
  ```bash
  pnpm turbo run lint typecheck test --filter=@repo/provider-sim
  pnpm lint:boundaries
  ```
- **Checkpoint de revisión humana:** confirmar la guardia de producción y que no hay lógica de negocio.
- **Riesgos / decisiones abiertas:** duplicación de la plantilla con `api`: se tolera en la Fase 0; extraer a `platform` solo si D-05 y el ADR lo recomiendan.

#### SUB-FASE 0.21 — Sentry y OpenTelemetry

- **Objetivo:** errores y trazas listos para staging, que en local no envían nada a internet ni exponen datos personales.
- **Estimación:** 5 h · **Depende de:** 0.18, 0.20, D-16 · **RH:** No · **Diseño previo:** No.
- **Archivos / paquetes / capas:** `packages/observability/src/{sentry,tracing}/` (inicializadores, filtro `beforeSend` que reutiliza el enmascarado de 0.7); integración en `apps/api`, `apps/worker` y `apps/provider-sim` (por ejemplo `src/instrumentation.ts` cargado antes de la app); pruebas. Dependencias: `@sentry/nestjs`, `@opentelemetry/*`.
- **Entregables:**
  - `initSentry`: sin DSN no hace nada; con DSN etiqueta `request_id`, entorno y versión, y limpia datos personales.
  - OpenTelemetry con exportador de consola cuando `OTEL_EXPORTER=console`; instrumentación de HTTP, `pg` e `ioredis`; `trace_id`/`span_id` en el mixin del logger.
  - Documentación de la carga anticipada de la instrumentación bajo ESM.
- **Criterios de aceptación:**
  1. Con un transporte de prueba, una excepción llega a Sentry con `request_id` y sin datos personales; sin DSN no se hace ninguna llamada de red.
  2. Una petición a `api` genera trazas con spans de HTTP y base de datos visibles por consola.
  3. Los logs incluyen `trace_id` cuando hay span activo.
  4. La instrumentación se carga correctamente en ESM (prueba de arranque).
  5. Ninguna prueba llama a internet.
- **Skills / MCPs:** Context7 (Sentry para NestJS, OpenTelemetry Node con ESM). El MCP de Sentry es de la Fase 3: no se instala.
- **Verificación:**
  ```bash
  pnpm turbo run lint typecheck test --filter=@repo/observability --filter=@repo/api --filter=@repo/worker
  pnpm test:int
  ```
- **Checkpoint de revisión humana:** revisar qué datos se envían a Sentry; si hay DSN de staging (D-16), verificar un evento real a mano.
- **Riesgos / decisiones abiertas:** D-16. La instrumentación automática de OpenTelemetry bajo ESM requiere un cargador (`--import`) y suele ser frágil; si bloquea, parar y proponer alternativa (instrumentación manual de los puntos críticos). Posible tarea diferible si el calendario aprieta.

### Bloque G — Contenedores y `pnpm dev`

#### SUB-FASE 0.22 — Imagen Docker de `api`

- **Objetivo:** una imagen de producción pequeña, sin privilegios y con comprobación de salud, y un objetivo de desarrollo para `watch`.
- **Estimación:** 5 h · **Depende de:** 0.10, 0.8 · **RH:** No · **Diseño previo:** Sí (estrategia de poda, `pnpm deploy`, generación de Prisma).
- **Archivos / paquetes / capas:** `apps/api/Dockerfile`, `.dockerignore` (excluye `.git`, `node_modules`, `.claude`, `docs`, `.env*`), servicio `api` (perfil `backend`) en `infra/docker/compose.yaml`.
- **Entregables:**
  - Etapas del plan: **poda** (`turbo prune @repo/api --docker`), **construcción** (`pnpm install --frozen-lockfile`, `prisma generate`, compilación) y **ejecución** (Node de D-01 sobre Debian slim, usuario sin privilegios, solo archivos compilados y dependencias de producción, `HEALTHCHECK`, `init` para señales).
  - Objetivo de desarrollo (`target: dev`) para `docker compose watch`.
  - Etiquetas de imagen base fijas (con resumen/digest si es viable).
- **Criterios de aceptación:**
  1. `docker compose ... build api` termina con código 0 y el tamaño de la imagen queda registrado.
  2. El proceso corre sin ser root (`id`), con `NODE_ENV=production`.
  3. El `HEALTHCHECK` pasa a `healthy` con la infraestructura arriba.
  4. La imagen no contiene secretos ni archivos de entorno (`.dockerignore` verificado).
  5. Cambiar solo código fuente no invalida la capa de dependencias (orden de capas correcto; evidencia con una segunda construcción).
  6. El esquema de Prisma y su cliente generado van en la imagen.
- **Skills / MCPs:** skill `turborepo` (`turbo prune`), `prisma-cli` (`generate`), Context7 (Docker multi-etapa, `pnpm deploy` en pnpm 12, BuildKit).
- **Verificación:**
  ```bash
  docker compose -f infra/docker/compose.yaml --env-file infra/docker/.env.example --profile backend build api
  docker compose -f infra/docker/compose.yaml --env-file infra/docker/.env.example --profile backend run --rm --no-deps --entrypoint id api
  docker compose -f infra/docker/compose.yaml --env-file infra/docker/.env.example --profile backend up -d --wait api
  docker compose -f infra/docker/compose.yaml --env-file infra/docker/.env.example --profile backend ps api
  ```
- **Checkpoint de revisión humana:** revisar el Dockerfile línea por línea (usuario, archivos copiados, `HEALTHCHECK`, base) y el `.dockerignore`.
- **Riesgos / decisiones abiertas:** el comportamiento de `pnpm deploy` cambió en versiones recientes de pnpm; Debian slim no trae `curl` (el `HEALTHCHECK` debe usar Node). No escribir `.env` literal en los comandos de verificación.

#### SUB-FASE 0.23 — Imágenes de `worker`, `provider-sim` y `migrator`

- **Objetivo:** las demás imágenes del plan, con la misma disciplina que `api`.
- **Estimación:** 3 h · **Depende de:** 0.22, 0.19, 0.20 · **RH:** No · **Diseño previo:** No.
- **Archivos / paquetes / capas:** `apps/worker/Dockerfile`, `apps/provider-sim/Dockerfile`, `infra/docker/migrator/Dockerfile` (CLI de Prisma fijada, copia `packages/db/prisma` y la config; ejecuta `prisma migrate deploy` como tarea única, **nunca al arrancar la API**); servicios en `compose.yaml`.
- **Entregables:**
  - `worker` sin puerto público, con `HEALTHCHECK` por latido; `provider-sim` marcada para no publicarse jamás en el registro de producción (etiqueta y nota); `migrator` mínima.
  - Servicio `migrator` como tarea de una sola ejecución dependiente de Postgres sano.
- **Criterios de aceptación:**
  1. Las tres imágenes se construyen, corren sin privilegios y no contienen secretos.
  2. El `HEALTHCHECK` de `worker` pasa a `healthy`.
  3. El `migrator` aplica las migraciones 0.15 a 0.17 sobre una base vacía y `prisma migrate status` queda al día (**lo ejecuta el usuario**, o el implementador con autorización explícita en el checkpoint, porque `migrate deploy` está vedado al agente).
  4. `api` no arranca ni ejecuta migraciones por sí misma.
- **Skills / MCPs:** `prisma-cli` (`migrate-deploy`, `agent-safety`), `turborepo`, Context7.
- **Verificación:**
  ```bash
  docker compose -f infra/docker/compose.yaml --env-file infra/docker/.env.example --profile backend build worker provider-sim migrator
  docker compose -f infra/docker/compose.yaml --env-file infra/docker/.env.example --profile backend up -d --wait worker provider-sim
  pnpm prisma migrate status
  ```
- **Checkpoint de revisión humana:** ejecutar tú el `migrator` contra la base local y comprobar el resultado; revisar que el `Dockerfile` del `migrator` no esté en el camino de despliegue de la API.
- **Riesgos / decisiones abiertas:** la política "deploy solo en CI/migrator" frente a ejecutar el migrator en local; el hook de Bash bloquea cualquier comando que contenga `prisma migrate deploy` (el servicio `migrator` evita escribirlo en la línea de comandos).

#### SUB-FASE 0.24 — Compose `backend`/`full`, `watch` y `pnpm dev`

- **Objetivo:** cumplir la primera parte del criterio de salida: `pnpm dev` levanta todo.
- **Estimación:** 4 h · **Depende de:** 0.23, 0.6 · **RH:** No · **Diseño previo:** No.
- **Archivos / paquetes / capas:** `infra/docker/compose.yaml` (perfiles `infra`, `backend`, `full`; `develop.watch`; dependencias por salud y por finalización del `migrator`), scripts de la raíz `dev`, `dev:infra`, `dev:down`; README de la raíz y de `infra/docker/`.
- **Entregables:**
  - Perfil `backend` = `infra` + `migrator` + `api` + `worker` + `provider-sim`, cada app esperando a sus dependencias sanas; `full` queda definido igual a `backend` hasta que exista la web (Fase 4).
  - `docker compose watch` con reglas de sincronización y reconstrucción por app.
  - `pnpm dev` = `docker compose -f infra/docker/compose.yaml --profile backend up --build --watch` y `pnpm dev:infra` (solo infraestructura, con las apps en el host con `turbo run dev`) como alternativa más rápida.
- **Criterios de aceptación:**
  1. Desde un clon limpio, `pnpm install --frozen-lockfile && pnpm dev` deja todos los servicios `healthy` sin pasos manuales.
  2. `http://localhost:3000/health`, el `/health` del simulador y el latido del worker responden.
  3. Editar un archivo de `apps/api` provoca la recarga automática (evidencia manual con tiempo medido).
  4. `dev:down` detiene todo sin borrar datos.
  5. El tiempo del primer arranque y el consumo de memoria quedan registrados.
- **Skills / MCPs:** Context7 (Compose `watch`, `depends_on` con `condition`, perfiles).
- **Verificación:**
  ```bash
  docker compose -f infra/docker/compose.yaml --env-file infra/docker/.env.example --profile backend config -q
  pnpm dev                                   # pide confirmación; proceso largo
  docker compose -f infra/docker/compose.yaml --env-file infra/docker/.env.example --profile backend ps
  curl -s -i http://localhost:3000/health
  ```
- **Checkpoint de revisión humana:** ejecutar tú `pnpm dev` desde cero y comprobar la recarga con un cambio real; confirmar tiempos y consumo aceptables.
- **Riesgos / decisiones abiertas:** consumo de memoria de WSL con todos los contenedores; rendimiento del `watch` con ESM y la compilación elegida en 0.8.

### Bloque H — CI completo y gobernanza

#### SUB-FASE 0.25 — CI de integración, migraciones e imágenes

- **Objetivo:** completar el pipeline con las pruebas de integración, las migraciones sobre una base vacía y la construcción y escaneo de imágenes.
- **Estimación:** 4 h · **Depende de:** 0.24, 0.5, D-17, P-03 · **RH:** No · **Diseño previo:** No.
- **Archivos / paquetes / capas:** `.github/workflows/ci.yml` (jobs nuevos), `.github/workflows/images.yml` si conviene separar.
- **Entregables:**
  - Job de integración (`pnpm test:int` con Docker del runner) y subida del informe de cobertura.
  - Job de migraciones: Postgres como servicio (misma versión mayor que local), `prisma migrate deploy` desde cero (en CI es lo previsto por el plan), `db seed` y `migrate status`; comprobación de que el esquema y las migraciones no divergen.
  - Job de imágenes: construir `api`, `worker`, `provider-sim` y `migrator` con caché de capas y escanear con Trivy; **sin publicar** (D-17).
  - Los umbrales de cobertura hacen fallar el PR.
- **Criterios de aceptación:**
  1. Todos los jobs verdes en un PR real.
  2. Una migración mal escrita (PR de prueba) hace fallar el job de migraciones.
  3. Un PR que baja la cobertura bajo el umbral falla.
  4. Las imágenes se construyen y Trivy reporta sin hallazgos HIGH/CRITICAL corregibles (o quedan registrados en el reporte).
  5. La imagen de `provider-sim` no tiene paso de publicación.
- **Skills / MCPs:** Context7 (GitHub Actions, `docker/build-push-action` con caché, Trivy). Acciones fijadas por SHA.
- **Verificación:**
  ```bash
  # Local, antes de empujar
  pnpm test:int
  docker compose -f infra/docker/compose.yaml --env-file infra/docker/.env.example --profile backend build
  # Remoto: PR de prueba verde y PR de prueba rojo, revisados en la pestaña Actions
  ```
- **Checkpoint de revisión humana:** revisar permisos de los jobs, uso de secretos (ninguno requerido) y el tiempo total del pipeline.
- **Riesgos / decisiones abiertas:** D-17. Duración del pipeline (cada job debe reutilizar caché). Trivy puede reportar vulnerabilidades heredadas de la imagen base.

#### SUB-FASE 0.26 — Gobernanza y cadena de suministro

- **Objetivo:** que ningún cambio sensible se fusione sin revisión y que las dependencias se actualicen con criterio.
- **Estimación:** 3 h · **Depende de:** 0.25, P-03 · **RH:** No · **Diseño previo:** No.
- **Archivos / paquetes / capas:** `.github/CODEOWNERS`, `.github/pull_request_template.md`, `.github/renovate.json`, job de `osv-scanner` en el workflow, `docs/gobernanza-del-repositorio.md` (lista de ajustes manuales de GitHub).
- **Entregables:**
  - `CODEOWNERS` para `.claude/`, `.mcp.json`, `CLAUDE.md`, `docs/architecture-rules.md`, `.github/`, `packages/db/prisma/migrations/` y los módulos `audit`, `outbox` e `idempotency` (confirmar el usuario de GitHub del responsable).
  - Plantilla de PR con las casillas del plan: "pruebas agregadas o actualizadas", revisión de arquitectura, revisión de migración y "toca dinero, `auth` o proveedores: revisión humana".
  - Renovate con espera mínima de varios días antes de adoptar versiones, bloqueo de `prisma` >= 8 y de saltos de versión mayor de Node sin ADR, y agrupación razonable.
  - Escaneo de dependencias con `osv-scanner` en cada PR.
  - Lista de ajustes manuales para el usuario: protección de la rama `main` (estado de CI obligatorio, revisión de CODEOWNERS), instalación de la app de Renovate.
- **Criterios de aceptación:**
  1. Un PR de prueba que toca `.claude/` solicita revisión al responsable.
  2. La plantilla aparece en un PR nuevo.
  3. `osv-scanner` se ejecuta en el PR.
  4. La configuración de Renovate es válida (validador oficial o corrida en seco).
  5. Los ajustes manuales quedan documentados y marcados como pendientes del usuario.
- **Skills / MCPs:** Context7 (CODEOWNERS, Renovate `minimumReleaseAge`, osv-scanner).
- **Verificación:** remota (PR de prueba) y `pnpm lint:format` sobre los archivos de configuración.
- **Checkpoint de revisión humana:** confirmar el usuario de CODEOWNERS y aplicar la protección de rama; revisar la plantilla.
- **Riesgos / decisiones abiertas:** el agente no puede cambiar la configuración de GitHub: es acción del usuario. Renovate necesita instalarse como app en el repositorio.

### Bloque I — Cierre

#### SUB-FASE 0.27 — Spike: hooks de auditoría de Better Auth (opcional)

- **Objetivo:** responder con evidencia si los hooks de Better Auth pueden escribir en `audit_log` dentro de la misma transacción que sus cambios, antes de diseñar `auth` en la Fase 1.
- **Estimación:** 4 h (con límite de tiempo estricto) · **Depende de:** 0.15, D-18 · **RH:** Sí · **Diseño previo:** No.
- **Archivos / paquetes / capas:** un directorio descartable `spikes/better-auth-audit/` **fuera del workspace y del CI** (o en una rama que no se fusiona), `docs/adr/0006-hooks-de-auditoria-de-better-auth.md`. Cero código de producción nuevo.
- **Entregables:**
  - Prueba mínima con Better Auth (núcleo + adaptador de Prisma) sobre Postgres desechable, usando los hooks `before`/`after` de endpoints y los hooks de base de datos.
  - Evidencia por evento: registro, inicio de sesión exitoso y fallido, cierre de sesión, cambio de contraseña. ¿La fila de auditoría queda en la misma transacción? ¿Qué pasa si el hook falla?
  - ADR con la recomendación (A: misma transacción; B: después de confirmar, con `outbox` como compensación; C: otra solución) y cómo se genera el esquema de Prisma de Better Auth en ESM.
- **Criterios de aceptación:**
  1. Seis eventos auditables probados, con resultado documentado para cada uno.
  2. El ADR indica qué cambia (si algo) en `audit` y en el diseño de `auth` de la Fase 1.
  3. El código del spike no entra en `main` ni en el CI.
  4. Sin llamadas a internet ni credenciales reales de Google.
- **Skills / MCPs:** Context7 (Better Auth: hooks, adaptador de Prisma, plugin de 2FA solo como lectura). No se instala una skill comunitaria de Better Auth.
- **Verificación:** los resultados de las pruebas del spike, resumidos en el reporte; `git status` limpio fuera de `docs/adr/`.
- **Checkpoint de revisión humana:** leer el ADR-0006 y decidir el diseño de auditoría de `auth` para la Fase 1.
- **Riesgos / decisiones abiertas:** D-18. Si la respuesta es "no es posible en la misma transacción", cambia el diseño de `audit` (aprobación del usuario antes de la Fase 1).

#### SUB-FASE 0.28 — Compuerta de salida de la Fase 0

- **Objetivo:** demostrar con evidencia que se cumplen los criterios de salida del plan y dejar documentada la base para la Fase 1.
- **Estimación:** 4 h · **Depende de:** todas las anteriores · **RH:** Sí · **Diseño previo:** No.
- **Archivos / paquetes / capas:** `README.md` completo (prerrequisitos, comandos, puertos, estructura), índice de `docs/adr/`, actualización propuesta de `CLAUDE.md` ("Estado actual" y comandos que ya existen) y, si cambió, de `docs/architecture-rules.md` (**ambos pendientes de revisión humana**), refinamiento de las skills propias con lo aprendido, el reporte final de auditoría de la fase en `docs/auditorias/fase-0.md`.
- **Entregables:**
  - Ejecución de la compuerta (sección 10) desde un clon limpio, con evidencia.
  - Barrido final de `architect-reviewer` sobre todo el repositorio.
  - Informe de cobertura por paquete y lista de dependencias con su justificación.
  - Lista de pendientes que pasan a la Fase 1 (decisiones D-xx aplazadas, deuda aceptada, riesgos abiertos).
- **Criterios de aceptación:** todos los de la sección 10.
- **Skills / MCPs:** `architect-reviewer`, Context7 solo si aparece una duda de API.
- **Verificación:** la secuencia de la sección 10.
- **Checkpoint de revisión humana:** revisar el informe de auditoría de la fase, los cambios propuestos a `CLAUDE.md`, y decidir si se abre la Fase 1.
- **Riesgos / decisiones abiertas:** ninguno nuevo; aquí se cierran o se trasladan los abiertos.

---

## 9. Trazabilidad con el plan maestro

| Entregable de la Fase 0 en el plan maestro | Sub-fase(s) |
| --- | --- |
| Monorepo, Turborepo | 0.1, 0.2 |
| CI | 0.5, 0.25, 0.26 |
| Docker Compose | 0.6, 0.24 |
| NestJS base | 0.8, 0.9, 0.18, 0.20 |
| Prisma | 0.10, 0.11, 0.13 |
| Imágenes Docker (`api`, `worker`, `provider-sim`, `migrator`) | 0.22, 0.23 |
| Logger | 0.7 |
| Sentry (y trazas OpenTelemetry) | 0.21 |
| Reglas de dependencia | 0.4 |
| `ClockService` | 0.12 |
| `outbox` | 0.16, 0.19 |
| `idempotency` | 0.17 |
| `audit` | 0.15 |
| Primer modelo de datos | 0.15, 0.16, 0.17 |
| Política de pruebas (Vitest, umbrales, Testcontainers) | 0.3, 0.11 |
| Skills `nest-module-scaffold`, `testing-policy`, `test-writer`; MCP de Prisma | 0.14, 0.10 |
| "Probar los hooks de auditoría de Better Auth en la semana 1" | 0.27 |
| Criterio de salida: `pnpm dev` levanta todo | 0.24 |
| Criterio de salida: pipeline en verde | 0.5, 0.25, 0.26, 0.28 |
| Criterio de salida: una migración aplicada | 0.15, 0.16, 0.17, 0.23, 0.25 |

---

## 10. Compuerta de salida de la Fase 0

Se ejecuta en 0.28, desde un clon limpio (`git clone` o `git worktree` en un directorio de trabajo temporal), y con evidencia pegada en el informe.

**Criterios literales del plan**

- [ ] `pnpm dev` levanta todo (infraestructura, `migrator`, `api`, `worker`, `provider-sim`), todos `healthy`, sin pasos manuales.
- [ ] El pipeline de CI está en verde en un PR real (calidad, fronteras, tipos, pruebas, integración, migraciones sobre base vacía, imágenes, escaneos).
- [ ] Hay al menos una migración aplicada: `pnpm prisma migrate status` reporta la base al día con las tres migraciones (`audit_log`, `outbox`, `idempotency_keys`).

**Criterios adicionales de esta planificación**

- [ ] `pnpm turbo run lint lint:boundaries typecheck test build` y `pnpm test:int` en verde desde el clon limpio.
- [ ] Cada fila "Nunca importa" de `architecture-rules.md` tiene una prueba negativa que falla.
- [ ] Ninguna lectura de la hora del sistema fuera de `ClockService` (regla de lint en verde).
- [ ] `audit_log` rechaza `UPDATE`, `DELETE` y `TRUNCATE`, incluso al dueño.
- [ ] `outbox` e `idempotency` pasan sus pruebas de atomicidad y concurrencia contra Postgres real.
- [ ] Cobertura por paquete >= los umbrales del plan (`domain` 90 % de ramas; módulos Nest 85 % de líneas).
- [ ] `architect-reviewer` sin hallazgos `BLOQUEANTE` ni `ALTA` en todo el repositorio.
- [ ] Sin secretos en el historial (gitleaks verde); `pnpm-lock.yaml` consistente; `prisma` fijado en 7.x.
- [ ] ADRs 0001 a 0005 (y 0006 si se hizo el spike) escritos y aceptados.
- [ ] `README.md` permite a una persona nueva llegar a `pnpm dev` sin ayuda.
- [ ] Todas las sub-fases en **Aprobada por usuario**.

Solo con todo marcado se autoriza el inicio de la Fase 1.

---

## 11. Riesgos globales de la Fase

| Riesgo | Impacto | Probabilidad | Mitigación |
| --- | --- | --- | --- |
| Docker no disponible en WSL (P-01) | Bloquea 0.6 en adelante | Alta (estado actual) | Resolver P-01 durante 0.1 a 0.5; esas sub-fases no lo necesitan |
| NestJS 12 es ESM-only y parte del ecosistema (decoradores con SWC, `nestjs-zod`, `@nestjs/bullmq`, OpenTelemetry) puede no estar listo | Retrasos en 0.3, 0.8, 0.9, 0.18, 0.21 | Media | Probar la combinación real en 0.3 y 0.8; ADR; plan B: Nest 11 (D-02 B) decidido temprano, no a mitad de fase |
| `prisma@latest` apunta a un RC de Prisma 8 | Instalar sin querer una versión prohibida | Media | Versión exacta `7.10.1`; criterio explícito en 0.10; regla en la sección 6; bloqueo en Renovate (0.26) |
| La estimación (112 h) no incluye los tiempos de revisión humana | Calendario de 3 a 4 semanas, no 2 | Alta | Calibrar tras 0.3; aprobar por lotes pequeños; diferir 0.27, 0.21 o parte de 0.26 si hace falta |
| Ubicación de los módulos compartidos sin resolver (D-05) | Rehacer 0.12 a 0.19 | Media | Decisión antes de 0.4 y ADR-0003 |
| Los permisos del hook de formato pueden bloquear escrituras por ESLint | Fricción continua | Media | Configuración de ESLint estable y probada en 0.2; ajustar reglas en el checkpoint |
| Errores en el SQL manual de migraciones (trigger, privilegios) | Pérdida de la garantía de inmutabilidad | Media | Revisión humana línea por línea en 0.15 a 0.17; pruebas con rol dueño y rol `app` |
| Sin remoto de GitHub no se puede cerrar 0.5, 0.25 ni 0.26 | La compuerta queda abierta | Media | P-03 temprano; D-04 |
| El agente no puede crear `.env` ni cambiar la configuración de GitHub | Pasos manuales del usuario | Cierta | Documentados en cada checkpoint y en `docs/gobernanza-del-repositorio.md` |
| El conocimiento del modelo sobre pnpm 12, Nest 12 y Node 24 es limitado | APIs inventadas o desactualizadas | Media | Regla de Context7 obligatoria; pruebas reales antes de ADR |
| El nuevo enfoque del producto (v2 del plan maestro) tienta a adelantar piezas de ahorro en la Fase 0 | Alcance inflado y compuerta retrasada | Baja | Fila 2B en la sección 2; la regla 5 de la sección 6 (no ampliar el alcance) aplica igual |

---

## 12. Bitácora de decisiones y cambios

Se completa durante la ejecución. Cada decisión, aprobación o cambio de alcance deja una fila.

| Fecha | Sub-fase | Tipo (decisión, aprobación, cambio de alcance, bloqueo) | Detalle | Registrado por |
| --- | --- | --- | --- | --- |
| 2026-11-12 | — | Creación del plan | Versión 1.0 del plan de la Fase 0. Hallazgos de entorno registrados en la sección 3 | development-planner |
| 2026-11-12 | 0.1 | Bloqueo | El `pnpm` del `PATH` en WSL es el ejecutable de Windows (`/mnt/c/.../npm/pnpm` → `pnpm.exe`, `process.platform = win32`, almacén en `C:\Users\...`). No sirve para instalar en el repositorio Linux. Falta decidir cómo proveer pnpm 12.18.0 en Linux. Al leer `packageManager`, ese pnpm descargó 12.18.0 y generó `pnpm-lock.yaml` (solo `packageManagerDependencies`) | backend-implementer |
| 2026-11-12 | 0.1 | Hallazgo | Calendario oficial de Node: Node 24 en mantenimiento desde 2026-10-20 (fin de vida 2028-04-30); Node 26 es LTS activo desde 2026-10-28. Anotado en ADR-0001; D-01 se mantiene salvo que el usuario decida otra cosa | backend-implementer |
| 2026-11-12 | 0.1 | Decisión | Usuario: Q-1 = A (pnpm 12.18.0 instalado en Linux con `npm install -g` sobre nvm; bloqueo resuelto); Q-2 corregido por el usuario (`.claude/` ya no se ignora, solo `settings.local.json`); Q-3 = `engineStrict: true`; Node 24 se mantiene y Node 26 LTS se evalúa en un ADR posterior. El lockfile no se pudo borrar (permiso de `rm` denegado): se comprobó que es idéntico al generado desde cero por el pnpm de Linux | backend-implementer |
| 2026-11-12 | 0.1 | Completada | Criterios 1 a 6 en verde; `architect-reviewer` sin hallazgos BLOQUEANTE ni ALTA. Pendiente: auditoría y aprobación del usuario | backend-implementer |
| 2026-11-12 | 0.1 | Aprobación | El usuario aprueba la 0.1 ("Aprobado, y continuemos con 0.2"). ADR-0001 pasa a Aceptado | backend-implementer |
| 2026-11-12 | 0.2 | Decisión | Usuario: Q-1 = `eslint-plugin-simple-import-sort@14.0.0`; Q-2 = `@eslint/js@10.0.1` en la raíz; Q-3 = `@types/node@24.19.2` en la raíz; Q-4 = B | backend-implementer |
| 2026-11-12 | 0.2 | Corrección | ADR-0001: `prettier` pasa de `3.10.1` a `3.10.0` (la 3.10.1 tenía menos de 24 h y pnpm la había eximido sola con `minimumReleaseAgeExclude`). Se quitó la excepción de `pnpm-workspace.yaml`; `pnpm install --frozen-lockfile` pasa la verificación de cadena de suministro sin excepciones. Nota en la sección "Correcciones" del ADR | backend-implementer |
| 2026-11-12 | 0.2 | Decisión (diseño) | `turbo.json`: tarea `transit` (`dependsOn: ["^transit"]`) para que un cambio en `@repo/config` invalide `lint`/`typecheck`/`test` de quien lo consume; tarea de raíz `//#lint:root` (solo `eslint.config.js` de la raíz; se invalida al cambiar `@repo/config` porque la raíz depende de él y entra en el hash global, comprobado); solo `build` (`dist/**`) y `test` (`coverage/**`) declaran `outputs`; `envMode: strict`. TypeScript: `target`/`lib` ES2024 (Node 24). ESLint: `js.configs.recommended` + `typescript-eslint` `strictTypeChecked` con `projectService`, `.js` sin tipos, `--max-warnings=0`, cada paquete con su `eslint.config.js`. Prettier: Markdown excluido (documentación mantenida por personas) | backend-implementer |
| 2026-11-12 | 0.2 | Completada | Criterios 1 a 6 en verde con salida real; `architect-reviewer` sin BLOQUEANTE ni ALTA (2 MEDIA: caché de `lint:root`, refutada con prueba; prueba de `createBaseConfig`, se cubre en 0.3) | backend-implementer |
| 2026-11-12 | 0.2 | Aprobación | Aprobación anticipada del usuario, transmitida por el coordinador: "una vez termines, aprueba y pasa a la 0.3" (condicionada a todo en verde y sin hallazgos bloqueantes/altos, condición cumplida) | backend-implementer |
| 2026-11-13 | 0.3 | Decisión | Usuario: Q-1 Vitest 5.1.0 + `@vitest/coverage-v8` 5.1.0; Q-2 `vite@8.3.8` fijado en la raíz y `esbuild` fuera de `allowBuilds` (confirmado: no se instala); Q-3 `unplugin-swc@2.0.0` + `@swc/core@1.16.22`; Q-4 todo en la raíz con versión exacta | backend-implementer |
| 2026-11-13 | 0.3 | Hallazgo corregido | Las fábricas `vitest/*.ts` fallaban al consumirse por `@repo/config/vitest/*` (`ERR_MODULE_NOT_FOUND .../vitest/base.js`): el cargador de configuración de Vite deja el paquete enlazado a Node, que lo carga quitando tipos. Primer intento (imports con `.ts` + `allowImportingTsExtensions`) descartado: un consumidor temporal con `tsc` falló con TS5097. Corrección final: las fábricas se importan entre sí por el export del propio paquete (`@repo/config/vitest/base`, auto-referencia de paquete) y `erasableSyntaxOnly` en el tsconfig de `@repo/config`. Verificado: `tsc` de un consumidor temporal con perfil Nest en verde, y Vitest cargando `@repo/config/vitest/node` y `/nest` desde la raíz | backend-implementer |
| 2026-11-13 | 0.3 | Revisión | `architect-reviewer`: 0 BLOQUEANTE, 0 ALTA, 4 MEDIA, 4 BAJA. Atendidas en 0.3: umbrales como piso (`resolveCoverageThresholds` rechaza bajar el mínimo del perfil), prueba del hook `transform` real del plugin SWC, aserción frágil retirada, convención de imports documentada, frase de "disco ajeno" corregida, correspondencia de perfiles con la tabla maestra. Quedan como decisión documentada: dependencias de `@repo/config` resueltas desde la raíz (sin `peerDependencies`). Pendiente para 0.8: prueba real de inyección de Nest con SWC | backend-implementer |
| 2026-11-13 | 0.3 | Revisión | Re-revisión del delta (`architect-reviewer`): 0 BLOQUEANTE, 0 ALTA, 1 MEDIA (un `undefined` explícito borraba el piso; sin validar `NaN` ni >100), corregida con pruebas; 3 BAJA (fila `config` en `architecture-rules.md` → 0.4; nota de specs con `.js` añadida al README; `this` vacío en la prueba del hook, fragilidad futura aceptada) | backend-implementer |
| 2026-11-13 | 0.3 | Completada | Criterios 1 a 5 en verde con salida real: `pnpm test` 29 pruebas y cobertura 100 % en todos los archivos; umbral incumplido → código 1; `pnpm test:int` código 0; consumo de las fábricas verificado desde otro paquete | backend-implementer |
| 2026-11-13 | 0.3 | Aprobación | Aprobación anticipada del usuario, transmitida por el coordinador: "cuando todo quede en verde, pasa a la 0.4 con las decisiones D-5 A, D-6 A, D-7 realiza la propuesta" (condición cumplida: todo en verde y sin hallazgos bloqueantes/altos) | backend-implementer |
| 2026-11-13 | 0.4 | Decisión | Usuario (vía coordinador): D-05 = A (`packages/platform`, `@repo/platform`); D-06 = A (`eslint-plugin-boundaries`); D-07 = propuesta del planner (filas para `observability`, `config`, `testing`, `platform`; confirmar capas hexagonales) | backend-implementer |
| 2026-11-13 | 0.4 | Decisión | Usuario (vía coordinador): diseño previo aprobado; `eslint-plugin-boundaries@7.4.3` (instalada a las 17:36 UTC, tras cumplir la espera de 24 h, sin excepción); `eslint-import-resolver-typescript@4.4.5` con `unrs-resolver: false` en `allowBuilds`; cambios a `architecture-rules.md` y `CLAUDE.md` aprobados (incluidas filas de `api-client` y `ui`); `packages/platform/.gitkeep` | backend-implementer |
| 2026-11-13 | 0.4 | Hallazgo corregido | Con descriptores `partialMatch: false`, `@boundaries/elements` 3.3.3 asigna el elemento de app/paquete en el primer nivel y no detecta padres: las capas hexagonales y FSD no se clasificaban. Corrección: patrones de derecha a izquierda (gana el elemento más interno) y "dentro de una app/paquete" por ruta de archivo (`file.path`). Guardas en las pruebas contra falsos verdes (cada `@repo/*` debe resolver como local) | backend-implementer |
| 2026-11-13 | 0.4 | Revisión | `architect-reviewer`: 1 BLOQUEANTE, 2 ALTA, 8 MEDIA, 3 BAJA. **Corregido:** BLOQUEANTE (la excepción de Prisma para "cualquier `infrastructure/`" reabría `@repo/db`/Prisma a `provider-sim`, `web`, `integrations`, `domain`, etc.; ahora solo `infrastructure/` de `api`, `worker`, `platform`, más `db` y `testing`; 15 pruebas negativas nuevas, que fallan con el código anterior) y las celdas "Nunca importa" sin prueba (`api-client`, `ui`, `config`, pares de apps) y archivos anidados; además, guarda final: un `@repo/*` que no resuelve a su paquete local es error (antes pasaba como módulo externo permitido). **Pendiente de decisión del usuario:** ALTA-1 (qué externos pueden importar los specs y archivos de configuración de `domain`, `contracts` y `observability`), ALTA-2 (capa `domain/` de un módulo como lista cerrada; `interface/` solo tipos de `domain`) y varias MEDIA. 0.4 queda En Progreso | backend-implementer |
| 2026-11-18 | 0.4 | Decisión | Usuario ("Aprobado, implementa las recomendaciones y continua", vía coordinador): ALTA-1 = (a) pruebas y configuración pueden importar cualquier externo/núcleo, sujetos a reglas internas; ALTA-2 = `domain/` lista cerrada (su propio `domain/` y `@repo/domain`), `interface/` puede importar valores de `domain/` ("tipos y errores"); M-1, M-2 y M-3 aplicadas; M-4 a ADR-0003 (revisión); M-5 y M-6 anotadas para Fase 2 / 0.20 | backend-implementer |
| 2026-11-18 | 0.4 | Hallazgo corregido | Al aplicar M-1, la política 3 generaba `allow: { to: [] }` para paquetes sin dependencias internas; el plugin captura el error ("Invalid dependency selector") y la política no se evalúa, sin que las pruebas lo notaran. Corregido (se omiten listas vacías) y nueva prueba estructural que falla ante cualquier lista o selector vacío (verificada reintroduciendo el defecto) | backend-implementer |
| 2026-11-18 | 0.4 | Revisión | Segunda revisión (`architect-reviewer`): 0 BLOQUEANTE, 1 ALTA, 7 MEDIA, 5 BAJA. **Corregido:** ALTA (la prueba M-3 fallaría en un clon limpio porque varias carpetas vacías de `apps/` y `packages/` no estaban versionadas: `.gitkeep` en `apps/{api,worker,provider-sim}` y `packages/{domain,contracts,db,observability,testing}`); globs con subrutas (`@prisma/**`, `@repo/**`); categoría `config` anclada a la raíz de cada app o paquete; capas hexagonales fuera de `apps/web`; pruebas de hermanos dentro de capa/slice, de "pruebas y configuración siguen sujetas" a Prisma y a reglas internas, y de imports de solo tipos. Limitación documentada: `import { type X }` cuenta como valor. **Pendiente de decisión:** si las pruebas dentro de `domain/` de api, worker o platform pueden usar `@repo/testing` (hoy no: la lista cerrada de `domain/` gana) | backend-implementer |
| 2026-11-18 | 0.4 | Revisión | Tercera revisión (`architect-reviewer`): 0 BLOQUEANTE, 0 ALTA, 0 MEDIA, 4 BAJA; las cuatro atendidas (precisión de `config` en la raíz en `architecture-rules.md`, patrón de capas en ADR-0002, pruebas de `prisma`/`prisma/**`, nombres de grupos de prueba por regla). Verificación final: `pnpm lint`, `lint:boundaries`, `typecheck`, `test` (264), `test:int` y `lint:format` en verde; segunda corrida FULL TURBO. No se marca Aprobada: en la segunda revisión apareció una ALTA (corregida) y la instrucción era detenerse y reportar | backend-implementer |
| 2026-11-18 | 0.4 | Decisión | Usuario: las pruebas dentro de `domain/` **no** pueden usar `@repo/testing` (se mantiene la lista cerrada y la prueba que lo fija). Registrado en ADR-0003 | backend-implementer |
| 2026-11-18 | 0.4 | Aprobación | Aprobación directa del usuario: "Dejarla cerrada como se recomienda, dejamos aprobado la 0.4 y continua con la 0.5." ADR-0002 y ADR-0003 pasan a Aceptado. D-08 = B registrada en la sección 4.2 | backend-implementer |
| 2026-11-18 | 0.5 | Avance | `.github/workflows/ci.yml` y `.github/actions/setup/action.yml`. Acciones fijadas por SHA de commit (obtenido con `git ls-remote`, etiquetas anotadas desreferenciadas): `actions/checkout` v7.0.1 `3d3c42e5…`, `actions/setup-node` v7.1.0 `949feb24…`, `pnpm/action-setup` v6.1.1 `73e46992…`, `gitleaks/gitleaks-action` v3.0.0 `e0c47f4f…`. Verificación local: YAML válido, todo `uses:` externo con SHA de 40 caracteres, los comandos de cada job en verde, `--affected` y la sonda de fronteras (`packages/domain/src/ci-probe.ts` → `zod`) que solo rompe `lint:boundaries`. Pendiente: corrida remota (push del usuario) y decisiones de la caché autoalojada | backend-implementer |
| 2026-11-18 | 0.5 | Revisión | `architect-reviewer`: 0 BLOQUEANTE, 1 ALTA, 3 MEDIA, 3 BAJA. Corregido: ALTA (envenenamiento de la caché remota desde PR de ramas del mismo repo: la caché remota solo se activa en push a `main`, nunca en PR); `cancel-in-progress` solo en PR; `globalDependencies` (`.nvmrc`, `pnpm-workspace.yaml`) para que `--affected` no omita paquetes ante cambios de toolchain; pasos con `!cancelled()`; guarda contra saltos de línea en las variables. SHA verificados con `git ls-remote`. Pendiente: criterios 2–4 (corrida remota) | backend-implementer |
| 2026-11-18 | 0.5 | Verificación remota | Primera corrida del PR de `phase-0` (informada por el usuario): todos los jobs en verde (Tests: 5 archivos, 264 pruebas) salvo el de gitleaks, con 2 hallazgos `generic-api-key` en el commit `c8242fa` | backend-implementer |
| 2026-11-18 | 0.5 | Excepción de seguridad | Los 2 hallazgos son falsos positivos: el ejemplo didáctico `sk_test_abc123xyz` de la skill externa `nestjs-best-practices` (`.claude/skills/nestjs-best-practices/rules/config-no-secrets.md:34` y `AGENTS.md:2614`), fijada por commit y que no se edita. Se ignoran en `.gitleaksignore` por su huella exacta (`c8242fa9762c0943a71296b62d7e8f0819abaa47:<archivo>:generic-api-key:<línea>`), sin excepciones por ruta ni por regla, así que una fuga real futura en esos archivos se sigue detectando. Ojo: si el PR se fusiona con *squash*, el commit nuevo tendrá otra huella y habrá que añadirla | backend-implementer |
| 2026-11-18 | 0.5 | Cambio | A pedido del usuario, los títulos de jobs y pasos del CI pasan al inglés: `Lint`, `Boundaries (lint:boundaries)`, `Typecheck`, `Tests`, `Build`, `Secrets (gitleaks)` (y los pasos visibles). Los comentarios del YAML siguen en español | backend-implementer |
| 2026-11-18 | 0.5 | Verificación remota | Push a `main` tras "Merge pull request #2 from phase-0" (merge commit `f2207c6`): 6 checks en verde (`Boundaries`, `Build`, `Lint`, `Secrets (gitleaks)`, `Tests`, `Typecheck`); gitleaks pasa con `.gitleaksignore`. PR #3 "ci: prueba de fronteras (no fusionar)" desde `ci/test-boundaries` (archivo `packages/domain/src/ci-test.ts` → `zod`) hacia `main`: solo falla `CI / Boundaries (lint:boundaries) (pull_request)`; los otros 5 en verde. Rama de prueba borrada. Evidencia: capturas del usuario verificadas por el agente principal | backend-implementer |
| 2026-11-18 | 0.5 | Decisión | Usuario: Q-1 caché remota autoalojada pospuesta hasta decidir el hosting de staging, sin caché en PR (D-08 = B sigue vigente, falta la infraestructura); Q-2 `actionlint` con versión fijada en la 0.26; Q-3 versiones de acciones (`checkout` v7.0.1, `setup-node` v7.1.0, `pnpm/action-setup` v6.1.1, `gitleaks-action` v3.0.0) y runner `ubuntu-24.04` confirmados. Nota: `gitleaks-action` v3 requiere `GITLEAKS_LICENSE` si el repositorio pasa a una organización | backend-implementer |
| 2026-11-18 | 0.5 | Aprobación | Aprobación directa del usuario: "Aprobado, ya corregí la rama, y estamos para trabajar en la actual. cierra 0.5 y comienza con la 0.6". Criterios 1 a 5 cumplidos | backend-implementer |
| 2026-11-18 | 0.6 | Verificación | P-01: Docker Engine 28.3.2 (Docker Desktop 4.44.2) y Compose v2.39.1 disponibles dentro de WSL; puertos 5432, 6379, 8025 y 1025 libres en WSL y en Windows. Hay contenedores parados de otro proyecto (`aios-postgres`, `aios-redis`) que podrían chocar si se arrancan | backend-implementer |
| 2026-11-18 | 0.6 | Decisión | Usuario ("Si, comienza"), D-09: `postgres:17.12-bookworm`, `redis:8.8.4-alpine`, `axllent/mailpit:v1.34.0`, todas con digest `@sha256`; puertos estándar en `127.0.0.1` sobreescribibles; roles `owner`/`app`/`readonly` (nombres reales `fintech_owner`/`fintech_app`/`fintech_readonly`) más `postgres` solo para el arranque; aislamiento de `provider_sim` en Fase 2; scripts `infra:up` e `infra:down` (nunca `down -v`) | backend-implementer |
| 2026-11-18 | 0.6 | Cambio de alcance | MinIO sale de la 0.6 (Q-3 = f): su edición comunitaria ya no publica binarios ni imágenes (solo código fuente; `minio/minio` responde 404 en Docker Hub) y nada en la Fase 0 usa S3. El emulador S3 se decide en la Fase 3 (candidato: RustFS). Actualizados la sección 0.6 (objetivo, entregables, criterios 2 y 3), el resumen de alcance y el plan maestro. ADR-0004 | backend-implementer |
| 2026-11-18 | 0.6 | Verificación | `config -q` código 0; `up -d --wait` deja `postgres`, `redis` y `mailpit` `healthy`; `pg_isready`, `redis-cli ping` → `PONG`, Redis con `appendonly yes` y `noeviction`; Mailpit responde en `localhost:8025`; bases `fintech` y `provider_sim` con dueño `fintech_owner`; tres roles; por TCP: `fintech_app` no puede crear tablas ni esquemas, `fintech_app`/`fintech_readonly` sin acceso a `provider_sim`, `fintech_readonly` sin `INSERT`, `fintech_owner` crea bases (sombra); datos de Postgres y Redis persisten tras `down` y `up` sin `-v` (marcadores retirados); `pnpm infra:up` idempotente; contenedores `aios-*` intactos | backend-implementer |
| 2026-11-18 | 0.6 | Revisión | `architect-reviewer`: 0 BLOQUEANTE, 1 ALTA, 2 MEDIA, 5 BAJA. Corregido: ALTA (el healthcheck de `postgres` por socket podía dar `healthy` antes de terminar el init; ahora por TCP, y se comprobó en el entrypoint de la imagen que el servidor temporal arranca con `listen_addresses=''`) y la fila D-09 (MinIO diferido). Anotado en ADR-0004 para sub-fases posteriores: DML de `fintech_app` sobre `_prisma_migrations` (0.10/0.15), `EXECUTE` de funciones para `PUBLIC` (0.15), `CONNECT` de `PUBLIC` en `postgres`/`template1` y Redis sin contraseña en staging. La comprobación del healthcheck sobre un volumen vacío requeriría `down -v` (no se ejecutó sin confirmación) | backend-implementer |
| 2026-11-18 | 0.6 | Aprobación | Aprobación directa del usuario: "Apruebo 0.6, pasemos a la 0.7 y una vez termina comienza con la 0.8". ADR-0004 pasa a Aceptado. Pendiente sin autorizar: probar el healthcheck sobre un volumen vacío (requiere `down -v`, no se ejecuta) | backend-implementer |
| 2026-11-18 | 0.7 | Avance | `@repo/observability`: `createLogger` (pino 10.4.0, JSON, `pino-pretty` 13.2.0 solo en `local`, `mixin` con `request_id`/`correlation_id`), enmascarado propio por nombre de clave a cualquier profundidad (`formatters.log`/`bindings` de pino no llegan a todo: `redact` de pino no admite profundidad arbitraria y `child()` reemplaza el formateador de bindings por una identidad), contexto de ejecución con `AsyncLocalStorage`. Defecto encontrado por las pruebas y corregido: los bindings de los loggers hijos no se enmascaraban (comprobado en `lib/proto.js` de pino); ahora `child` enmascara antes de delegar y lo heredan los nietos. Versiones de pino y pino-pretty con más de 24 h, sin excepciones | backend-implementer |
| 2026-11-18 | 0.7 | Decisión (propuesta) | ADR-0005: paquetes internos compilados con `tsc` a `dist/`, con condición de export `source` → `src/` para el resolutor de fronteras (sin `dist/`, `lint:boundaries` vería `@repo/*` sin resolver). Verificado: resolución de `@repo/observability` sin `dist/` y arranque de `dist/` con Node. Resolutor con `noWarnOnMultipleProjects` | backend-implementer |
| 2026-11-18 | 0.7 | Revisión | `architect-reviewer`: 0 BLOQUEANTE, 2 ALTA, 3 MEDIA, 4 BAJA. **Corregido:** ALTA-1 (los errores, incluido `err`, se serializaban con sus propiedades propias sin enmascarar: ahora `redact` convierte cada `Error` a tipo, mensaje, pila, propiedades propias y `cause`, y el serializador `err` de pino pasa a identidad para no reprocesarlo); ALTA-2 (las instancias de clases, como DTOs y entidades, no se recorrían: ahora se recorren sus propiedades propias y se aplica `toJSON` como `JSON.stringify`); claves compuestas y de IP ampliadas (MEDIA); prueba de la condición `source` (BAJA). **Pendiente de decisión del usuario:** hora del log frente a la regla 6 de CLAUDE.md, claves propias del dominio y ADR-0005 | backend-implementer |
| 2026-11-18 | 0.6 | Verificación | `down -v` autorizado por el usuario ("Aplica el down-v si"), solo para el proyecto `fintech-arriendos`: borró `fintech-arriendos_pg-data` y `fintech-arriendos_redis-data`; volúmenes `aios-*` intactos. La sesión se cortó (HTTP 429) antes de volver a levantar; al retomar, `docker` no está disponible en WSL (Docker Desktop parado o sin integración). Pendiente: levantar sobre el volumen vacío y comprobar el healthcheck | backend-implementer |
| 2026-11-18 | 0.6 | Verificación | Con Docker reactivado (Engine 28.3.2), `pnpm infra:up` sobre volumen vacío, muestreando el estado cada segundo: t=3 s `starting`; t=4 s servidor temporal del init listo (`health` sigue `starting`); t=5 s se ejecuta `01-roles-y-bases.sh`; t=8 s, tras el arranque del servidor definitivo, `healthy`; `infra:up` código 0. Después: `ps` con los tres servicios `healthy` solo en 127.0.0.1; `pg_isready -h 127.0.0.1` → `accepting connections`; `redis-cli ping` → `PONG`; Mailpit `readyz` ok; bases `fintech` y `provider_sim` con dueño `fintech_owner`; roles `fintech_app`, `fintech_owner` (`createdb=true`) y `fintech_readonly`; `fintech_app` CREATE TABLE → `permission denied for schema public`. Contenedores `aios-*` intactos. La infra queda levantada | backend-implementer |
| 2026-11-18 | 0.7 | Decisión | Usuario: D1 = excepción de reloj solo para el logger (ADR-0006, regla 6 de `CLAUDE.md` actualizada, regla de ESLint `no-restricted-syntax` contra `Date.now()`, `new Date()` y `Date()` en todo el código, pruebas y configuración salvo `packages/observability` con `allowSystemTime`); en 0.8 el logger añade `simulatedAt` vía `mixin` si el reloj es simulado y usa hora fija en `test`. D2 = claves de dominio (ingresos como sufijo; hogar, `household`, producto de ahorro, llave Bre-B, `direccion`, `address` exactas; `nombre` fuera). D3 = ADR-0005 aceptado con `types` antes de `source`, `^build` donde hace falta y condición `source` en Vitest | backend-implementer |
| 2026-11-18 | 0.7 | Verificación | El `redact` nativo de pino se hereda en los hijos, pero solo con rutas exactas: deja en claro `a.b.email` y `list[].email` y no admite sufijos. Se mantiene el enmascarado propio y la sobrescritura de `child`, documentado en el README del paquete. Para D3: el resolutor de fronteras pasa a `conditionNames: ['source', 'import', 'node', 'default']` (sin `types`); en Vitest la condición `source` va en `ssr.resolve.conditions` (entorno `node`) además de `resolve.conditions`, según la documentación de Vitest 5; `test` ya no depende de `^build` | backend-implementer |
| 2026-11-18 | 0.7 | Revisión | Re-revisión (`architect-reviewer`): 0 BLOQUEANTE, 0 ALTA, 4 MEDIA, 9 BAJA. Corregido: huecos de la regla de reloj (referencia `Date.now` sin llamar, `Date['now']`, `globalThis.Date`), con pruebas; nota de que `no-restricted-syntax` debe extenderse con `SYSTEM_TIME_RESTRICTIONS`; redacción de la regla 6 en `CLAUDE.md`; estado de la 0.7 y contexto de ADR-0005. Propuesto (revisión humana): alinear la sección 4 de `docs/architecture-rules.md` con ADR-0006. Anotados: mecanismo de excepción de `SystemClock` (0.12), salida de `pino-pretty` sin probar, variantes de claves de dominio exactas | backend-implementer |
| 2026-11-18 | 0.7 | Aprobación | Instrucción del usuario transmitida por el coordinador: "Si no quedan BLOQUEANTE ni ALTA y no tienes preguntas abiertas que bloqueen, marca 0.7 Aprobada por usuario … y arranca 0.8" (condición cumplida). Pendientes que no bloquean: revisión humana de la propuesta para `architecture-rules.md` y la verificación de la 0.6 sobre volumen vacío (Docker no disponible en WSL) | backend-implementer |
| 2026-11-18 | 0.8 | Bloqueo | D-10 (Express o Fastify) sin respuesta, y el plan deja para la 0.8 la herramienta de compilación y recarga (con ADR). Versiones comprobadas (todas con más de 24 h): `@nestjs/common`, `core`, `platform-express`, `platform-fastify` y `testing` 12.5.1; `@nestjs/config` 12.1.1; `@nestjs/cli` 12.0.13; `reflect-metadata` 0.2.2; `rxjs` 7.8.2; `zod` 4.6.7; `helmet` 8.3.0; `supertest` 7.3.2; `@types/supertest` 7.2.1; `@types/express` 5.0.6; `nestjs-pino` 5.3.2; `tsx` 4.23.15. Sin código escrito | backend-implementer |
| 2026-11-18 | 0.8 | Decisión | Usuario: Q-1 = Express (D-10 = A); Q-2 = `tsc` + `tsc --watch` / `node --watch dist/main.js` (ADR-0007); Q-3 = `@nestjs/testing` 12.5.1, `@types/supertest` 7.2.1 y `@types/express` 5.0.6 como desarrollo de `@repo/api`; Q-4 = adaptador propio `NestLogger` sobre `createLogger`, sin `nestjs-pino`; variables `APP_ENV`, `HTTP_PORT`, `ALLOWED_ORIGINS`, `LOG_LEVEL`, `TRUST_PROXY=false`, `HTTP_BODY_LIMIT=100kb`. La propuesta de cambio a la sección 4 de `architecture-rules.md` (ADR-0006) sigue pendiente, sin aplicar | backend-implementer |
| 2026-11-18 | 0.8 | Avance | `apps/api` (`@repo/api`): `createApp(env)` sin `listen` en `src/create-app.ts` (helmet primero, sin `x-powered-by`, `trust proxy`, `useBodyParser` con límite, CORS con lista blanca, versionado URI `/v1`, `/health` con `VERSION_NEUTRAL`, `enableShutdownHooks`, `abortOnError: false`); `bootstrap()` con mensaje de arranque sin valores, código 1 y cierre de la app si falla `listen`; `main.ts` solo arranca; esquema Zod del entorno (`parseEnv`; puerto vacío rechazado y puerto 0 solo en `local`/`test`); `NestLogger` sobre `@repo/observability` (hora fija en `APP_ENV=test`, ADR-0006); `ShutdownLogger` (línea de cierre ordenado). Soporte: `@repo/observability` reexporta el tipo `Logger`; regla `no-extraneous-class` con `allowWithDecorator` (módulos de Nest), con prueba; `turbo.json`: `test:int` depende de `build` propio y `dev` pasa las variables de la API (`passThroughEnv`). Propuesta `apps/api/CLAUDE.md` (revisión humana) y ADR-0007 | backend-implementer |
| 2026-11-18 | 0.8 | Verificación | Criterio 1: `Test.createTestingModule` resuelve `HealthController` ← `HealthService` sin `@Inject` (metadatos bajo ESM + SWC). Criterios 2 y 3 (e2e con Supertest): `/health` 200, sin `x-powered-by`, cabeceras de helmet (también en las respuestas 413), CORS acepta el origen de la lista y rechaza otro (también en preflight), cuerpo JSON o urlencoded mayor que el límite → 413, `/v1` sin rutas → 404, `trust proxy` `false` por defecto y numérico con `TRUST_PROXY=2`. Criterios 4 y 5 (`test:int` sobre `dist/main.js`): variable inválida o ausente → código 1 y mensaje sin el valor; `SIGTERM` cierra la conexión keep-alive abierta y registra `api cerrada (SIGTERM)`. Criterio 6: 97,6 % de líneas. Manual: `pnpm turbo run dev --filter=@repo/api` y petición a `localhost:3000/health` → 200 con cabeceras de helmet (procesos de `dev` detenidos después) | backend-implementer |
| 2026-11-18 | 0.8 | Revisión | `architect-reviewer`: 0 BLOQUEANTE, 0 ALTA, 4 MEDIA, 7 BAJA. Corregidos: la prueba de SIGTERM ahora exige la línea de cierre ordenado; la app se cierra si falla `listen`; pruebas de `trust proxy`, helmet en errores y límite `urlencoded`; puerto vacío o 0 fuera de `local`/`test` rechazado; prueba de proceso sin entorno; el contexto de Nest no lo pisa un campo `context`. Anotados: huérfano posible de `tsc --watch` en `dev` (ADR-0007, se revisa en 0.24); `ALLOWED_ORIGINS` acepta `http://` y `localhost` en producción (checkpoint); la ruta `src/modules/<nombre>/…` del `CLAUDE.md` propuesto es una convención nueva (revisión humana) | backend-implementer |
| 2026-11-18 | 0.8 | Decisión | Usuario (checkpoint 0.8): `apps/api/CLAUDE.md` aprobado con la convención `src/modules/<nombre>/{domain,application,infrastructure,interface}`; `ALLOWED_ORIGINS` exige `https://` fuera de `local` y `test` y rechaza `*`, rutas, barra final, `localhost`, `127.0.0.1`, `::1` y `*.localhost` (con pruebas); sección 4 de `docs/architecture-rules.md` alineada con ADR-0006 | backend-implementer |
| 2026-11-18 | 0.6–0.8 | Commits | El usuario commiteó 0.6, 0.7 y 0.8 en `523c6a5` (rama `phase-0`); el agente principal commiteó, por orden explícita del usuario, los puntos 1–3 del checkpoint de la 0.8 en `8f7331a`. El implementador no hizo commits. Verificado por el agente principal en un clon limpio: `pnpm install --frozen-lockfile`, `lint`, `lint:boundaries`, `typecheck`, `test`, `test:int`, `build` y `lint:format` en verde (`typecheck`, `build` y `test:int` con `--force`) | backend-implementer |
| 2026-11-18 | 0.8 | Aprobación | Instrucción del usuario transmitida por el agente principal: "…corre la suite completa desde un clon limpio y, si queda en verde, aprueba la 0.8 y avanza." (condición cumplida) | backend-implementer |
| 2026-11-19 | 0.9 | Hallazgo | `nestjs-zod` 5.6.0 (última, publicada el 2026-11-08) declara como dependencia par `@nestjs/common` `^10 \|\| ^11`: **no admite Nest 12**. Admite `zod` `^3.25 \|\| ^4`. Según el plan, el diseño previo propone una alternativa. 0.9 en diseño previo, sin código; D-11 pendiente | backend-implementer |
| 2026-11-19 | 0.9 | Decisión | Usuario ("Aprobado, comienza"): D-11 según la tabla propuesta; Q-2 = pipe propio (`createZodDto` + `ZodValidationPipe` global), sin `nestjs-zod` (no admite Nest 12; migrable cuando lo admita); Q-3 = `DomainError` en `apps/api/src/common/errors/` hasta la 0.12 (pasa a `@repo/domain`); Q-4 = `userAgent` opcional en el contexto de `@repo/observability`, que el logger no escribe. ADR-0008 | backend-implementer |
| 2026-11-19 | 0.9 | Avance | `@repo/contracts` (solo `zod` 4.6.7, compilado según ADR-0005): `problemDetailsSchema`, `problemTypeFor`. `apps/api/src/common/`: `request-context.middleware.ts`, `problem-mapper.ts`, `problem-responder.ts` (lo usan el filtro global y el manejador de errores de Express para `body-parser`), `all-exceptions.filter.ts`, `zod-validation.pipe.ts`, `request-validation.error.ts`, `errors/domain-error.ts`. `createApp(env, { extraModules, logDestination })`: módulos y destino de logs solo para pruebas; orden de middlewares: helmet, contexto, CORS (expone `X-Request-Id`), cuerpo, errores de Express. Controlador solo de pruebas en `test/support/` (fuera de `tsconfig.build.json`) | backend-implementer |
| 2026-11-19 | 0.9 | Revisión | `architect-reviewer`: 0 BLOQUEANTE, 1 ALTA, 4 MEDIA, 6 BAJA. **ALTA** (el contexto de `AsyncLocalStorage` se perdería en la lectura asíncrona de `body-parser`): **no se reproduce**. `test/e2e/context-chunked.e2e-spec.ts` envía cuerpos troceados con pausas a un servidor real, con dos peticiones concurrentes; el handler ve su contexto y su cuerpo completo, y un JSON roto da `MALFORMED_BODY` con el mismo `request_id` en cuerpo, cabecera y log. Se añade además una defensa: si faltara el contexto, el responder usa la cabecera `X-Request-Id` que ya puso el middleware. **Corregido**: `createApp` rechaza `extraModules` fuera de `APP_ENV=test` (con prueba); una `HttpException` con estado fuera de 400–599 sale como 500; prueba propia de `AllExceptionsFilter`. **Documentado en ADR-0008 (limitaciones)**: el pipe deja pasar sin validar si el DTO no tiene metadatos (`import type` o interfaz); los logs de 5xx guardan el texto libre del error (revisar en 0.10/0.11); `DomainError` → `@repo/contracts` deberá duplicar el patrón al pasar a `@repo/domain` en 0.12; códigos reservados en `DomainError`. **Pendiente de revisión humana**: actualizar `apps/api/CLAUDE.md` (orden de middlewares, carpeta `common/`), con propuesta en el reporte | backend-implementer |
| 2026-11-19 | 0.9 | Cierre | **Completada** (pendiente de aprobación del usuario). Verificación en verde: `turbo run lint typecheck` 10/10; `lint:boundaries` sin errores; `turbo run test` 4/4 (config 274, observability 60, contracts 16 con 100 %, api 101 con 98,28 % de líneas y 94,55 % de ramas); `turbo run build` 3/3; `turbo run test:int` 4 pruebas (sin specs ni `test/support` en `dist/`; `/v1/pruebas/*` da 404 en el proceso real); `lint:format` sin cambios | backend-implementer |
| 2026-11-19 | 0.9 | Aprobación | Instrucción del usuario transmitida por el coordinador: "Apruebo, y actualiza CLAUDE con la mejor recomendación que se requiera. y comienza con la 0.10." Aprobación directa; ADR-0008 sigue Aceptado. `apps/api/CLAUDE.md` actualizado con la propuesta del reporte (orden real de `create-app.ts`, carpeta `src/common/`, reglas de errores, DTO y pruebas de cuerpo inválido); el diff va al reporte para revisión humana | backend-implementer |
| 2026-11-19 | 0.10 | Hallazgo | Diseño previo, sin código. (1) `ADR-0004` ya es "Infraestructura local": las convenciones de datos que el plan ubica en `0004-convenciones-de-datos.md` irían en un ADR nuevo (0009). (2) Prisma 7: `env()` en `prisma.config.ts` falla en `prisma generate` si falta `DATABASE_URL` (la documentación recomienda `process.env`); Prisma 7 no carga `.env` por sí mismo. (3) npm: `prisma`, `@prisma/client` y `@prisma/adapter-pg` 7.10.1 (2026-10-15), `pg` 8.23.1, `latest` de `prisma` = `8.0.0-rc.34`. (4) Docker no está disponible en esta distro de WSL en este momento (integración de Docker Desktop). Decisiones devueltas al usuario | backend-implementer |
| 2026-11-19 | 0.10 | Decisión | Usuario (transmitido por el coordinador): "Ya levante docker desktop y el infra. yo me encargo de comitear todo, apruebo las decisiones recomendadas y comienza." D-12 = a; Q-2 ADR-0009 (no 0004); Q-3 `process.loadEnvFile` si existe `.env`, con `.env.example` en la raíz; Q-4 semilla compilada; Q-5 sin variable de base en la api; Q-6 `db` al 85 % de líneas | backend-implementer |
| 2026-11-19 | 0.10 | Avance | `prisma` 7.10.1 (raíz), `@prisma/client` y `@prisma/adapter-pg` 7.10.1 en `@repo/db` (`pg`/`@types/pg` 8.23.1 transitivas), sin excepciones de `minimumReleaseAge`. `prisma.config.ts` y `tsconfig.json` (solo ese archivo) en la raíz; `lint:root` lo compila y lintea. `packages/db`: esquema sin modelos (generador `prisma-client`, ESM, imports `.js`), `createPrismaClient`, semilla (`SELECT 1` como prueba de conexión: con adaptador, `$connect()` no conecta y una clave incorrecta pasaba), `turbo.json` del paquete (`db:generate` antes de `build`, `typecheck`, `lint`, `test` y `transit`). El cliente generado lleva `// @ts-nocheck`: no hubo que relajar `strict`. `toBeInstanceOf` no sirve con el cliente (es un Proxy) | backend-implementer |
| 2026-11-19 | 0.10 | Revisión | `architect-reviewer`: 0 BLOQUEANTE, 1 ALTA, 4 MEDIA, 7 BAJA. **ALTA** (ADR-0009 usaba `@default(now())` para `createdAt`, que ignora `ClockService`): corregido, toda hora de negocio la entrega `ClockService`. **MEDIA**: `transit` de `db` depende de `db:generate` (los dependientes que prueban con la condición `source` lo heredan); `lint:boundaries` y `lint:root` sin cliente generado: **pasan** (comprobado), y se añadió el caso `prisma.config.ts` de la raíz a `boundaries.spec.ts`; ADR-0009 exige `REVOKE UPDATE, DELETE` en las tablas de solo inserción. **BAJA corregidas**: la semilla tapa la cadena de conexión en los errores (con prueba) y reconoce su entrada por `realpath`; README; estado del ADR a Propuesto hasta el checkpoint; nota de `uuid(7)` en SQL; `.gitkeep` retirado; nota de la versión repetida en tres sitios | backend-implementer |
| 2026-11-19 | 0.10 | Cierre | **Completada** (pendiente de aprobación y del checkpoint de revisión humana). `pnpm prisma validate` y `generate` código 0; `migrate status` conecta a `fintech` en `127.0.0.1:5432` y reporta "No migration found" (código 1: base aún no gestionada, esperado); `pnpm prisma db seed` contra Docker correcto; `turbo run typecheck build --filter=@repo/db --force` genera el cliente desde cero; `git check-ignore` lo ignora; lockfile sin 8.0.0-rc. Suite: `lint` 10/10, `typecheck` 8/8, `test` 6/6 (db 14 pruebas, 96 % de líneas), `build` 5/5, `test:int` 4, `lint:format` limpio. **MCP `prisma-local`**: carga `prisma.config.ts` y el esquema, pero `migrate-status` pide `datasource.url` porque no existe `.env` en la raíz (lo crea el usuario: `cp .env.example .env`) | backend-implementer |
| 2026-11-19 | 0.10 | Aprobación | Instrucción del usuario transmitida por el coordinador: "Listo, todo en orden, aprobado, continua a la 0.11". Aprobación directa, que incluye el checkpoint de revisión humana; ADR-0009 pasa a Aceptado | backend-implementer |
| 2026-11-19 | 0.11 | Hallazgo | Antes de instalar, sin código. Docker 28.3.2 y los tres servicios healthy. `testcontainers`, `@testcontainers/postgresql` y `@testcontainers/redis` 12.2.2 se publicaron hoy (2026-11-19 15:08 UTC): no cumplen `minimumReleaseAge`; 12.2.1 (2026-10-13) sí, y es la que fija la matriz para `@testcontainers/postgresql`. `ioredis` 6.0.0 (2026-07-31). El perfil de integración ya existe en `@repo/config` (`kind: 'integration'`), sin `globalSetup` ni tiempos de espera. El reloj manual del plan depende del puerto `Clock`, que nace en la 0.12. Decisiones devueltas al usuario (versiones, imágenes, Ryuk, migraciones, roles, aislamiento, reloj, cobertura) | backend-implementer |
| 2026-11-19 | 0.11 | Decisión | Usuario (transmitido por el coordinador): "Apruebo Q-1 a Q-9 como recomiendas, continúa con la 0.11". Testcontainers 12.2.1 exacto (también `testcontainers` directo) e `ioredis` 6.0.0; imágenes con digest iguales a Compose, con prueba; Ryuk activado y reutilización desactivada; despliegue de migraciones de Prisma solo contra el contenedor, con salvaguarda; script de roles de Compose; `TRUNCATE` y `FLUSHDB` antes de cada prueba, archivos en serie; reloj manual a la 0.12; `globalSetup` y 120 s en el perfil de integración; perfil `utility` sin contar contenedores ni `global-setup` | backend-implementer |
| 2026-11-19 | 0.11 | Hallazgo | `@repo/config`: perfil de integración con `globalSetup`, `testTimeout`/`hookTimeout` de 120 s y archivos en serie, más la opción `coverageExclude` (279 pruebas en verde). Al instalar Testcontainers, pnpm (`strictDepBuilds`) se detiene: `cpu-features@0.0.10` (`node-gyp rebuild`), `ssh2@1.17.0` (`install.js`, enlace nativo opcional) y `protobufjs@7.6.6` (`postinstall` de comprobación) no están en `allowBuilds`; las tres vienen de `dockerode`/`docker-modem`. Además, el hook `guard-bash.sh` bloquea cualquier comando del agente que mencione el despliegue de migraciones de Prisma, y la Q-4 aprobada lo ejecuta desde el harness. Las dos cosas se devuelven al usuario; instalación sin completar | backend-implementer |
| 2026-11-19 | 0.11 | Decisión | Usuario (transmitido por el coordinador): decisión 1 = a (`cpu-features`, `ssh2` y `protobufjs` en `allowBuilds: false`, con comentario); decisión 2: comprobar primero si el hook interviene sobre procesos hijos; si hiciera falta, autoriza por escrito la opción a) con cinco condiciones (solo la URL del contenedor propio; ignorar `DATABASE_URL` del entorno; prueba que rechace sandbox y producción; el agente no ejecuta el comando a mano; ADR que nombre el comando) | backend-implementer |
| 2026-11-19 | 0.11 | Avance | Instalación completa; `pnpm install --frozen-lockfile` pasa la política de cadena de suministro. El hook `guard-bash.sh` solo inspecciona el texto de los comandos Bash del agente (`.tool_input.command`): el despliegue de migraciones que lanza el harness como proceso hijo de `pnpm test:int` no pasa por él (comprobado). El hook no se modificó y el agente no escribió el comando a mano. `@repo/testing`: imágenes de Compose con digest y prueba; Postgres con el script de roles de Compose y contraseñas sintéticas; Redis con `noeviction`; `migrateDatabase` con salvaguarda y entorno hijo desde cero; `resetDatabase`/`resetRedis`; `globalSetup` con `project.provide`; `createTestPrismaClient`; `prisma` 7.10.1 declarado en el paquete y `vitest` 5.1.0 como dependencia par. ADR-0010 con el comando exacto | backend-implementer |
| 2026-11-19 | 0.11 | Revisión | `architect-reviewer`: 0 BLOQUEANTE, 1 ALTA, 5 MEDIA, 6 BAJA. **ALTA** (`resetDatabase` aceptaba cualquier cliente y podía vaciar el Postgres de Compose): corregido con una marca de base desechable (`fintech_harness.disposable`) que solo pone el harness; `resetDatabase` se niega sin ella (probado en unitarias y comprobado contra Compose: rechaza sin vaciar). **MEDIA corregidas**: el `globalSetup` para lo ya arrancado si algo falla y el teardown usa `allSettled`; exige Ryuk activo; tiempo máximo de 100 s para las migraciones; `packages/testing/turbo.json` incluye `compose.yaml` en las entradas de `test`. **MEDIA pendiente de decisión**: `passThroughEnv` de Docker para `test:int` (hoy funciona con el socket por defecto). **BAJA corregidas**: ruta del script de roles con `fileURLToPath`; `vitest` como dependencia par; la prueba de humo exige `permission denied` y que las migraciones versionadas estén todas aplicadas; prueba de `global-setup` con dependencias falsas. **Anotadas en ADR-0010**: trigger `BEFORE TRUNCATE` de la 0.15; CI sin `test:int`; Ryuk sin digest; `.env` en el proceso hijo | backend-implementer |
| 2026-11-19 | 0.10–0.11 | Commits | El agente principal, por orden del usuario, commiteó la 0.11 en `713beb4`, el ADR-0009 en `3d0a957` y la corrección de tiempos de los specs de ESLint de `@repo/config` en `ea48fa1` (0.9 y 0.10 ya estaban commiteadas por el usuario). Verificó desde un clon limpio: lint, `lint:boundaries`, typecheck, build, `lint:format`, `test:int --force` y sin contenedores huérfanos. El implementador no hizo commits | backend-implementer |
| 2026-11-19 | 0.11 | Corrección | `turbo run test --force` fallaba en frío en el clon limpio: la primera prueba de `eslint/base.spec.ts` superaba los 5 s (carga en frío de typescript-eslint con 7 tareas en paralelo). Calentamiento en `beforeAll` (60 s) y límite de 20 s acotado a los `describe` de ESLint en `base.spec.ts` y `boundaries.spec.ts`; el perfil global no cambia. Con carga extra se vio el mismo riesgo en `@repo/api` (arranque de Nest) | backend-implementer |
| 2026-11-20 | 0.11 | Aprobación | Instrucción del usuario transmitida por el agente principal: "Apruebo, implementa las recomendaciones, y continua a 0.12". 0.11 Aprobada por usuario | backend-implementer |
| 2026-11-20 | 0.11 | Corrección | Recomendaciones aplicadas. (1) `apps/api`: calentamiento compartido (`test/support/nest-test-timeouts.ts`, crea e inicia una app mínima) en `beforeAll` con 60 s, y límite de 20 s solo en los `describe` que arrancan Nest (`bootstrap.spec`, `health.controller.spec`, `app`, `errors` y `context-chunked` e2e). Con carga extra (un clon ejecutando en paralelo typecheck, build, lint y test con `--force`): 3 de 3 corridas en verde, api 101/101. (2) `turbo.json`: `test:int` con `passThroughEnv` de `DOCKER_HOST`, `DOCKER_CONFIG`, `DOCKER_CERT_PATH` y `DOCKER_TLS_VERIFY` (sin `TESTCONTAINERS_*`). `--dry=json` muestra `DOCKER_HOST` en `passthrough`, y Testcontainers lo lee (con un socket inexistente lo intenta y pasa a la siguiente estrategia); `test:int` 8/8 en verde | backend-implementer |
| 2026-11-20 | 0.12 | Hallazgo | Diseño previo, sin código (lo pidió el usuario aunque el plan dice "Diseño previo: No"). (1) El puerto del plan `Clock { now(): Date }` es síncrono, pero el reloj controlable vive en Redis (asíncrono) y debe verse igual desde varias instancias. (2) El plan lista `platform/clock/` plano; las fronteras (ADR-0003) esperan capas dentro de cada módulo. (3) D-13 sigue sin resolver. (4) Mecanismo de la excepción de ESLint para `SystemClock` (ADR-0006). (5) Traslado de `DomainError` a `@repo/domain` y duplicación del patrón de códigos con `@repo/contracts`. Sin versiones nuevas: Nest 12.5.1 e `ioredis` 6.0.0 ya están fijados. Decisiones devueltas al usuario | backend-implementer |
| 2026-11-20 | 0.12 | Decisión | Usuario (transmitido por el coordinador): "Apruebo y comienza". Q-1 a Q-9 según la recomendación: D-13 = A; puerto asíncrono; desfase en Redis con `SystemClock` inyectado; `systemClockFiles` solo en `platform`; capas en `platform/clock`; `CLOCK_MODE` y `REDIS_URL` en la api con `ClockModule` en `AppModule`; `ManualClock` en `@repo/testing`; `DomainError` a `@repo/domain` con prueba de coincidencia del patrón; `simulatedAt` pospuesto. Q-10: diff de la regla 6 de `CLAUDE.md` preparado, sin aplicar | backend-implementer |
| 2026-11-20 | 0.12 | Compromiso pospuesto | `simulatedAt` en los logs (aprobado para la 0.8 en ADR-0006, punto 3) se difiere a la Fase 2, con el panel de simulación: el `mixin` de pino es síncrono y el puerto del reloj ya no lo es. Anotado en ADR-0006 (seguimiento) y ADR-0011 (punto 9) | backend-implementer |
| 2026-11-20 | 0.12 | Avance | `@repo/domain` (puerto `Clock` asíncrono; `DomainError` y `ERROR_CODE_PATTERN`, trasladados desde `apps/api/src/common/errors/`, que se retira). `@repo/platform` (`ClockService` y `ControllableClockService` como tokens; `SystemClock`; `RedisControllableClock` con desfase en `fintech:clock:offset_ms`; `ClockModule.forRoot` global). `@repo/config`: opción `systemClockFiles`. `@repo/testing`: `ManualClock`. `apps/api`: `CLOCK_MODE` y `REDIS_URL` en el esquema y en `.env.example`, `ClockModule` en `AppModule`, prueba de coincidencia del patrón de códigos con `@repo/contracts`. Sin versiones nuevas | backend-implementer |
| 2026-11-20 | 0.12 | Revisión | `architect-reviewer`: 0 BLOQUEANTE, 1 ALTA, 4 MEDIA, 7 BAJA. **ALTA** (la segunda defensa de `ClockModule.forRoot` fallaba abierta con un modo o un ambiente desconocidos, p. ej. `Controllable` o `Production`): corregida, falla cerrado con lista de ambientes permitidos y `switch` con `default` que lanza; con pruebas. **MEDIA corregidas**: `now()` nunca devuelve `Invalid Date` y `advance` se acota al rango de `Date`; tiempos límite de conexión y de comando en Redis y listener de errores; el índice de `platform` ya no exporta las implementaciones. **MEDIA pendiente de revisión humana**: textos de la regla 6 de `CLAUDE.md`, la sección 4 de `architecture-rules.md` y `apps/api/CLAUDE.md` (diffs preparados, sin aplicar). **BAJA corregidas**: desfase con formato entero canónico; cierre de Redis que no falla si cae la conexión; validación estricta de `systemClockFiles`; prueba real de módulo global; `REDIS_URL` también validada como URL. **BAJA anotadas**: la prueba unitaria del reloj controlable importa `@repo/testing` por su índice (arrastra Prisma y Testcontainers, hoy funciona); ciclo latente si `testing` llegara a importar `platform` | backend-implementer |
| 2026-11-20 | 0.12 | Cierre | **Completada** (pendiente de aprobación y del checkpoint de revisión humana). `pnpm lint` 17/17 (incluye `lint:boundaries`); `turbo run typecheck` 15/15; `turbo run test` 9/9 (platform 57 pruebas, 98,27 % de líneas; domain 100 %; api 107; config 281; testing 45); `turbo run build` 8/8; `test:int` 11/11 (platform: dos instancias de Nest ven el mismo instante controlado con el Redis del harness); `lint:format` limpio. La excepción de ESLint se comprobó sobre rutas reales de `platform` (`system.clock.ts` 0 errores de reloj; sus vecinos, 2) | backend-implementer |
| 2026-11-13 | 0.3 | Decisión (diseño) | Cobertura v8 siempre activa en las unitarias (`pnpm test` hace cumplir el umbral sin depender de `--coverage`); perfil `utility` = 80 % de líneas (el plan no fija la métrica); integración sin cobertura y con `passWithNoTests`; SWC del perfil Nest con opciones `jsc` explícitas (`tsconfigFile: false`) en lugar de inferirlas del tsconfig | backend-implementer |
| 2026-11-13 | — | Cambio de alcance del plan maestro | Plan maestro v2: el gancho pasa a ser el ahorro para compra de vivienda (Meta Casa); fase nueva 2B, cuatro módulos nuevos y el plan total pasa de 24 a 29 semanas. Sin impacto en el alcance, las estimaciones ni la compuerta de la Fase 0. Este plan pasa a la versión 1.1: fila 2B en la sección 2, candidatas de enmascarado en el checkpoint de 0.7, un riesgo en la sección 11 y nombres de archivo corregidos en el encabezado. El estado de las sub-fases no se tocó | sesión principal, por orden del usuario |

---

## 13. Plantilla de reporte de auditoría post-sub-fase

Copiar este bloque para cada auditoría. El implementador lo rellena en las secciones 1 a 3 al pedir la auditoría; el planner completa el resto y emite el veredicto.

```markdown
# Auditoría — Sub-fase 0.N: <nombre>

| Campo | Valor |
| --- | --- |
| Fecha | AAAA-MM-DD |
| Implementador | backend-implementer |
| Auditor | development-planner |
| Rama / commit | <rama> / <hash o "sin commit"> |
| Estimación vs. real | <h estimadas> / <h reales> |
| Estado solicitado | Completada |

## 1. Resumen de lo realizado
<Qué se hizo, en 5 a 10 líneas. Desvíos respecto al plan.>

## 2. Validación de entregables
| Entregable del plan | Presente | Ubicación | Observación |
| --- | --- | --- | --- |
| <entregable 1> | Sí / No / Parcial | <ruta> | |

## 3. Cumplimiento de criterios de aceptación
| # | Criterio | Cumple | Evidencia (comando y salida resumida) |
| --- | --- | --- | --- |
| 1 | <criterio> | Sí / No | <comando> → <resultado> |

## 4. Calidad
| Aspecto | Resultado | Detalle |
| --- | --- | --- |
| Reglas de dependencia (`lint:boundaries`, `architect-reviewer`) | OK / Hallazgos | <cantidad por gravedad> |
| Reglas no negociables de CLAUDE.md (dinero, hora, ledger, idempotencia, auditoría) | OK / Hallazgos | |
| Pruebas: unitarias / integración / cobertura frente al umbral | OK / Hallazgos | <porcentajes> |
| Seguridad (secretos, datos personales en logs, permisos de BD, inyección SQL) | OK / Hallazgos | |
| Dependencias nuevas (exactas, justificadas, sin `latest`, sin código muerto) | OK / Hallazgos | <lista> |
| Documentación y ADR | OK / Hallazgos | <rutas> |
| Convenciones del plan (nombres, ESM, capas) | OK / Hallazgos | |

## 5. Riesgos identificados
| Riesgo | Impacto | Probabilidad | Acción propuesta |
| --- | --- | --- | --- |

## 6. Cambios de alcance y decisiones tomadas
- <Decisión, quién la tomó, dónde se registró (bitácora, ADR).>
- <Hallazgos fuera de alcance diferidos y a qué sub-fase se proponen.>

## 7. Lecciones aprendidas
- <Qué funcionó, qué fricción hubo, qué mejorar en las próximas sub-fases.>

## 8. Recomendaciones y ajustes al plan
- <Cambios a estimaciones, criterios, orden o dependencias de sub-fases siguientes.>

## 9. Veredicto del auditor
- [ ] APTA PARA REVISIÓN HUMANA (todos los criterios cumplidos)
- [ ] CON OBSERVACIONES (se puede revisar; corregir antes de aprobar: <lista>)
- [ ] RECHAZADA (volver a trabajar: <motivos>)

## 10. Checkpoint para el usuario
- [ ] <Ítem 1 del checkpoint de la sub-fase>
- [ ] <Ítem 2>
- Decisiones abiertas que necesitan tu respuesta: <D-xx, ...>

## 11. Registro de aprobación
| Aprobada por usuario | Fecha | Comentarios |
| --- | --- | --- |
| Sí / No | AAAA-MM-DD | |
```
