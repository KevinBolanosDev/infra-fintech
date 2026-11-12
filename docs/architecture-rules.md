# Reglas de arquitectura

Fuente: sección "Arquitectura del monorepo" del plan de desarrollo. Este archivo es lo que lee el subagente `architect-reviewer` y lo que debe hacer cumplir el linter de dependencias en CI (`eslint-plugin-boundaries` o `dependency-cruiser`, aún sin configurar).

> Correcciones respecto al plan: la tabla original dice que `domain` nunca importa "Drizzle"; el ORM decidido es **Prisma**. Las reglas de capas de la sección 2 están **inferidas** de la arquitectura hexagonal que describe el plan (el plan solo nombra las capas); confirmarlas con un ADR.

## 1. Dependencias entre paquetes y apps

| Paquete o app | Puede importar | Nunca importa |
| --- | --- | --- |
| `domain` | Nada externo (solo TypeScript) | NestJS, Prisma, HTTP, proveedores |
| `contracts` | `zod` | `domain` interno, `db` |
| `db` | `@prisma/client`, `domain` (solo tipos) | `integrations`, ninguna app |
| `integrations` | `domain`, `contracts` | `db`, ninguna app |
| `api`, `worker` | todos los paquetes de backend | `web`, `ui` |
| `provider-sim` | `contracts`, `integrations` (formas de payload) | `db` de la plataforma (tiene su propia base) |
| `web` | `contracts`, `api-client`, `ui`, utilidades puras de `domain` | `db`, `integrations` |

Además:
- La web y el simulador solo hablan con la API por HTTP, nunca por import.
- `api` y `worker` comparten lógica vía `packages/*` y se coordinan por colas en Redis, no por import entre apps.
- Una app nunca importa de otra app.
- Un módulo nunca lee las tablas de otro módulo: se comunica por casos de uso o eventos.

## 2. Capas dentro de cada módulo de NestJS (hexagonal) — inferido

| Capa | Contiene | Puede importar | Nunca importa |
| --- | --- | --- | --- |
| `domain/` | Entidades y reglas del módulo | Nada (ni NestJS ni Prisma) | `application`, `infrastructure`, `interface` |
| `application/` | Casos de uso (`CreateLease`, `ReserveCharge`), transacciones, orquestación | `domain` (y puertos definidos aquí o en `domain`) | `infrastructure`, `interface`; Prisma directo |
| `infrastructure/` | Repositorios con Prisma, adaptadores de proveedores, colas | `domain`, `application` (para implementar puertos) | `interface` |
| `interface/` | Controladores HTTP, receptores de webhooks, consumidores de colas | `application`, tipos de `domain`, `contracts` | `infrastructure` directamente (pasa por inyección), Prisma |

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
