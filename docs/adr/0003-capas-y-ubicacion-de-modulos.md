# ADR-0003 — Capas confirmadas y ubicación de los módulos compartidos

| Campo | Valor |
| --- | --- |
| Estado | Propuesto (pendiente de revisión humana en el checkpoint de la sub-fase 0.4) |
| Fecha | 2026-11-13 |
| Decisores | Usuario (dueño del proyecto) |
| Sub-fase / fase | 0.4 (Fase 0) |
| Relacionado con | D-05 = A, D-07 = propuesta del planner; ADR-0002; `docs/architecture-rules.md`; `CLAUDE.md` |

## Contexto

- El plan dice que "api y worker comparten la lógica de packages", pero su lista de nueve paquetes no tiene dónde poner módulos NestJS compartidos (`clock`, `audit`, `outbox`, `idempotency`), y una app no puede importar de otra.
- `docs/architecture-rules.md` no tenía fila para `observability`, `config`, `testing`, `api-client` ni `ui`, y marcaba las capas hexagonales de la sección 2 como "inferidas".
- Hay módulos puramente técnicos (`config`, `health`) para los que cuatro capas no aportan nada.

## Decisión

1. **D-05 = A:** nuevo paquete `packages/platform` (`@repo/platform`) para los módulos NestJS transversales. Los módulos de negocio nacen en `apps/api` y se extraen cuando el worker los necesite (se decide al empezar la Fase 1 o 2). El directorio se crea en la 0.4 (`.gitkeep`); su primer módulo llega en la 0.12.
2. **D-07 (propuesta del planner, más dos filas):**
   - `observability`: solo pino, OpenTelemetry, Sentry y núcleo de Node; sin `domain`, `db`, NestJS ni apps.
   - `config`: nada interno; lo puede importar cualquier app o paquete, solo desde sus archivos de configuración (`*.config.{js,ts}`) (M-1).
   - `testing`: `domain`, `contracts`, `db`, `platform`; nunca apps; solo se importa desde las pruebas de `api`, `worker` y `platform` (M-2; evita, por ejemplo, el ciclo `domain.spec` → `testing` → `domain`).
   - `platform`: `domain`, `contracts`, `db` (solo desde `infrastructure/`), `observability`, NestJS, BullMQ, ioredis; nunca apps, `web`, `ui` ni `integrations`.
   - Añadidas por el implementador y aprobadas por el usuario: `api-client` solo importa `contracts`; `ui` no importa nada interno.
   - `api` y `worker` pueden importar `platform`.
3. **Capas hexagonales de la sección 2: firmes** (ya no "inferidas"). Prisma y `@repo/db` solo en `infrastructure/` de `api`, `worker` y `platform`, en `packages/db` y en `packages/testing`.
   - `domain/` de un módulo es **lista cerrada** (ALTA-2): solo su propio `domain/` y `@repo/domain`; nada externo, ninguna otra capa, el `domain/` de ningún otro módulo y ningún otro paquete interno.
   - `interface/` puede importar valores de `domain/` (por ejemplo, errores para traducirlos a HTTP): la tabla dice "tipos y errores de `domain`".
   - **Pruebas y configuración** (ALTA-1): los `*.spec.ts`, `*.int-spec.ts`, `*.e2e-spec.ts`, `test/**` y `*.config.{js,ts}` pueden importar cualquier módulo externo o del núcleo de Node aunque su paquete o capa los restrinja (`vitest`, `fast-check`, `eslint/config`…). Siguen sujetos a las reglas entre paquetes internos y a la de Prisma.
4. **Responsabilidad de la revisión (M-4):** "un módulo nunca lee las tablas de otro" no se expresa con reglas de lint (dos módulos de la misma app son el mismo elemento salvo por sus capas). Lo controlan la revisión humana y `architect-reviewer`.
5. **Anotado para después, sin cambios ahora:** `provider-sim` tendrá su propia base en la Fase 2 y puede necesitar Prisma en su `infrastructure/` (M-5); la 0.20 querrá el logger de `observability` en `provider-sim` (M-6). Ambas requieren añadir la fila correspondiente cuando lleguen. `apps/web` se endurece en la Fase 4 (archivos fuera de las capas FSD).
6. **Módulos técnicos sin cuatro capas:** `config` y `health` (y equivalentes puramente técnicos) son un módulo NestJS plano. Si un módulo técnico empieza a tener reglas o adaptadores, pasa a las cuatro capas.

## Alternativas consideradas

| Alternativa | Por qué se descarta |
| --- | --- |
| D-05 = B: un paquete único con todos los módulos (transversales y de negocio) | Coincide con A en la Fase 0; decide de antemano dónde viven los módulos de negocio, que es mejor decidir con la Fase 1–2 a la vista |
| D-05 = C: todo en `apps/api` y el worker como segundo punto de entrada | Rompe "una app nunca importa de otra" o fuerza a duplicar el arranque |
| Restringir con lista cerrada los módulos externos de `platform` | Los que necesita (`rxjs`, `zod`, etc.) cambian con cada sub-fase; se restringen sus imports internos |

## Consecuencias

- `docs/architecture-rules.md` y el mapa de `CLAUDE.md` se actualizan (revisión humana).
- Las reglas se aplican con `eslint-plugin-boundaries` (ADR-0002) y cada fila "Nunca importa" tiene su prueba negativa.
- Se vuelve a validar sobre archivos reales cuando exista el primer módulo de `platform` (0.12).

## Verificación

```bash
pnpm lint:boundaries
pnpm turbo run test --filter=@repo/config
```
