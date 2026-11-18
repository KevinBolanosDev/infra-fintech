# Reglas de arquitectura

Fuente: sección "Arquitectura del monorepo" del plan de desarrollo. Este archivo es lo que lee el subagente `architect-reviewer` y lo que hace cumplir el linter de dependencias: `eslint-plugin-boundaries` (`packages/config/eslint/boundaries.js`, ADR-0002), que corre en `pnpm lint`, en `pnpm lint:boundaries`, en CI y en el hook de edición. Cada fila "Nunca importa" tiene una prueba que falla en `packages/config/eslint/boundaries.spec.ts`.

> Correcciones respecto al plan: la tabla original dice que `domain` nunca importa "Drizzle"; el ORM decidido es **Prisma**. Las reglas de capas de la sección 2 quedaron confirmadas en el ADR-0003 (antes eran inferidas). Las filas de `observability`, `config`, `testing`, `platform`, `api-client` y `ui` se añadieron con D-05 y D-07 (ADR-0003).

## 1. Dependencias entre paquetes y apps

| Paquete o app | Puede importar | Nunca importa |
| --- | --- | --- |
| `domain` | Nada externo (solo TypeScript) | NestJS, Prisma, HTTP, proveedores, ningún otro paquete interno |
| `contracts` | `zod` | `domain` interno, `db` |
| `db` | `@prisma/client`, `domain` (solo tipos) | `integrations`, ninguna app |
| `integrations` | `domain`, `contracts` | `db`, ninguna app |
| `observability` | `pino`, OpenTelemetry, Sentry, módulos del núcleo de Node | `domain`, `db`, NestJS, ninguna app |
| `config` | Nada interno (es tooling: tsconfig, ESLint, Prettier, Vitest) | Ningún otro paquete ni app. Solo se importa desde los archivos de configuración de la raíz de cada app o paquete (`*.config.{js,mjs,cjs,ts,mts,cts}`; uno anidado no cuenta) |
| `testing` | `domain`, `contracts`, `db`, `platform` | Ninguna app. Solo se importa desde las pruebas (`*.spec.ts`, `*.int-spec.ts`, `*.e2e-spec.ts`, `test/**`) de `api`, `worker` y `platform`, fuera de su capa `domain/` |
| `platform` | `domain`, `contracts`, `db` (solo desde `infrastructure/`), `observability`, NestJS, BullMQ, ioredis | Ninguna app, `web`, `ui`, `integrations` |
| `api-client` | `contracts` | `domain`, `db`, `integrations`, ninguna app |
| `ui` | Nada interno | Ningún otro paquete interno ni app |
| `api`, `worker` | todos los paquetes de backend (`domain`, `contracts`, `db`, `integrations`, `observability`, `platform`; `testing` solo en pruebas) | `web`, `ui` |
| `provider-sim` | `contracts`, `integrations` (formas de payload) | `db` de la plataforma (tiene su propia base) |
| `web` | `contracts`, `api-client`, `ui`, utilidades puras de `domain` (el lint permite todo `@repo/domain`; "puras" lo controla la revisión) | `db`, `integrations` |

Además:
- La web y el simulador solo hablan con la API por HTTP, nunca por import.
- `api` y `worker` comparten lógica vía `packages/*` y se coordinan por colas en Redis, no por import entre apps.
- Una app nunca importa de otra app.
- Un módulo nunca lee las tablas de otro módulo: se comunica por casos de uso o eventos.
- `config` lo puede importar cualquier app o paquete, pero solo desde los archivos de configuración de su raíz (`*.config.{js,mjs,cjs,ts,mts,cts}`: `eslint.config.js`, `vitest.config.ts`…; un `*.config.ts` anidado, por ejemplo dentro de `domain/`, no cuenta; los `tsconfig.json` lo extienden).
- Las pruebas (`*.spec.ts`, `*.int-spec.ts`, `*.e2e-spec.ts`, `test/**`) y los archivos de configuración pueden importar cualquier módulo externo o del núcleo de Node (`vitest`, `fast-check`, `eslint/config`…) aunque su paquete o capa los restrinja. Siguen sujetos a las reglas entre paquetes internos y a la de Prisma.
- Los módulos NestJS transversales (`clock`, `audit`, `outbox`, `idempotency`) viven en `packages/platform`; los de negocio nacen en `apps/api` (D-05, ADR-0003).

## 2. Capas dentro de cada módulo de NestJS (hexagonal)

| Capa | Contiene | Puede importar | Nunca importa |
| --- | --- | --- | --- |
| `domain/` | Entidades y reglas del módulo | Solo su propio `domain/` y `@repo/domain` (lista cerrada) | Nada externo (ni NestJS, ni Prisma, ni `zod`, ni Node), `application`, `infrastructure`, `interface`, el `domain/` de otro módulo, otros paquetes internos |
| `application/` | Casos de uso (`CreateLease`, `ReserveCharge`), transacciones, orquestación | `domain` (y puertos definidos aquí o en `domain`) | `infrastructure`, `interface`; Prisma directo |
| `infrastructure/` | Repositorios con Prisma, adaptadores de proveedores, colas | `domain`, `application` (para implementar puertos) | `interface` |
| `interface/` | Controladores HTTP, receptores de webhooks, consumidores de colas | `application`, tipos y errores de `domain`, `contracts` | `infrastructure` directamente (pasa por inyección), Prisma |

- Prisma (`@prisma/client` y sus subrutas) y `@repo/db` solo se importan desde `infrastructure/` de `api`, `worker` y `platform`, desde `packages/db` y desde `packages/testing` (pruebas de integración). Las pruebas y los archivos de configuración también están sujetos a esta regla.
- `packages/db` importa `domain` solo con `import type { X }` o `export type { X } from`: el linter trata `import { type X }` como import de valor.
- Las capas hexagonales aplican a `api`, `worker`, `provider-sim` y a los paquetes; `apps/web` usa FSD (sección 3).
- Los módulos puramente técnicos (`config`, `health`) no llevan las cuatro capas (ADR-0003).
- "Un módulo nunca lee las tablas de otro" (sección 1) no tiene regla de lint: lo controlan la revisión de código y `architect-reviewer` (ADR-0003).

Módulos transversales (`audit`, `outbox`, `idempotency`, `clock`) se consumen por inyección, no copiando su lógica.

## 3. Frontend (`apps/web`): FSD adaptado a App Router

Orden de capas de arriba hacia abajo; **cada capa solo importa de las de abajo**:

`app/` (rutas de Next.js) → `src/core` → `src/views` → `src/widgets` → `src/features` → `src/entities` → `src/shared`

- `app/` solo define rutas y layouts; no contiene lógica.
- Dentro de una misma capa, los slices no se importan entre sí.
- `shared` importa `api-client` y `ui`, nunca de capas superiores.

## 4. Señales de alerta en revisión

- `number` o `float` para dinero; `Date.now()` / `new Date()` fuera de `ClockService`.
- `UPDATE` o `DELETE` sobre `ledger_*`, `audit_log` o `provider_events`.
- Lógica de negocio en un controlador, o acceso a Prisma desde `application/` o `interface/`.
- Un endpoint que crea o mueve algo sin `Idempotency-Key`.
- Un webhook que cambia un estado sin consultar al proveedor.
- Un módulo nuevo sin `audit` ni `outbox` donde cambia estado o dinero.
- Archivos con lógica sin su `*.spec.ts`.
