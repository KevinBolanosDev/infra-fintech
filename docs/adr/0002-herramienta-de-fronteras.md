# ADR-0002 — Herramienta que hace cumplir las reglas de dependencia

| Campo | Valor |
| --- | --- |
| Estado | Aceptado (aprobado por el usuario el 2026-11-18, checkpoint de la sub-fase 0.4) |
| Fecha | 2026-11-13 |
| Decisores | Usuario (dueño del proyecto) |
| Sub-fase / fase | 0.4 (Fase 0) |
| Relacionado con | D-06 = A; ADR-0001 (toolchain); ADR-0003 (capas y ubicación de módulos); `docs/architecture-rules.md` |

## Contexto

`docs/architecture-rules.md` define qué puede importar cada app y paquete (sección 1), las capas hexagonales de cada módulo NestJS (sección 2) y las capas FSD de `apps/web` (sección 3). `CLAUDE.md` exige que "un import prohibido es un defecto, no un atajo", así que las reglas deben romper el build, y conviene que el agente lo sepa en el mismo momento en que escribe el import (hook `PostToolUse` que ejecuta ESLint sobre cada archivo editado).

## Decisión

1. **`eslint-plugin-boundaries@7.4.3`** como herramienta principal (D-06 = A), con la regla `boundaries/dependencies` en modo `default: "disallow"` y `checkAllOrigins: true` (también evalúa módulos externos y del núcleo de Node). Políticas en orden; la última que coincide gana.
2. **`eslint-import-resolver-typescript@4.4.5`** como resolutor de imports. El resolutor de Node que trae el plugin no traduce `./x.js` → `x.ts` (convención ESM del monorepo) y no sirve para las reglas de capas. El de TypeScript sigue los enlaces simbólicos de pnpm hasta la ruta real (`@repo/x` → `packages/x/...`), así que los paquetes internos se clasifican como elementos locales. Su dependencia `unrs-resolver` tiene un `postinstall` que solo comprueba el binario nativo: queda **denegado** en `allowBuilds` (`unrs-resolver: false`); el binario llega como dependencia opcional (`@unrs/resolver-binding-*`) y la resolución se verificó sin el script.
3. **Dónde corre:**
   - Dentro de `createBaseConfig` (`@repo/config/eslint/base`): `pnpm lint` de cada paquete y el hook de edición avisan en vivo.
   - `pnpm lint:boundaries` (tarea de raíz `//#lint:boundaries`, parte de `pnpm lint`): solo las reglas de fronteras sobre todo el repositorio, con `eslint.boundaries.config.js`, para el job de CI.
4. **Clasificación:** cada app y paquete es un elemento (`apps/<x>`, `packages/<x>`); las capas hexagonales (`{apps/api,apps/worker,apps/provider-sim,packages/*}/src/**/{domain,application,infrastructure,interface}`) y las capas/slices FSD de `apps/web` son elementos más internos. "Dentro de una app o paquete" se selecciona por ruta de archivo (`file.path`), no por jerarquía de elementos, porque los descriptores `partialMatch: false` del plugin no detectan padres (comprobado leyendo `@boundaries/elements` 3.3.3).
5. **Pruebas:** `packages/config/eslint/boundaries.spec.ts` con la API de Node de ESLint sobre un mini-monorepo de archivos reales (`packages/config/eslint/__fixtures__/boundaries/`), porque con rutas virtuales el resolutor no puede clasificar los imports. Una prueba que falla por cada arista prohibida y una que pasa por cada arista permitida, más guardas contra falsos verdes (cada `@repo/*` debe resolver como local).

## Alternativas consideradas

| Alternativa | Por qué se descarta |
| --- | --- |
| `dependency-cruiser` (D-06 = B) | Corre fuera de ESLint: el hook no avisaría al escribir el import. Exige Node >= 22. Puede añadirse después para ciclos y módulos huérfanos |
| Ambas (D-06 = C) | Duplica configuración en la Fase 0 sin necesidad |
| `eslint-plugin-boundaries@7.4.2` | La 7.4.3 cumplía la espera mínima de pnpm (24 h) al instalarla (2026-11-13 17:36 UTC); no hizo falta ninguna excepción |
| Resolutor de Node del plugin | No resuelve `./x.js` → `x.ts`; las reglas de capas no verían los archivos |
| `turbo boundaries` | Solo comprueba imports entre paquetes del workspace, no capas ni FSD |

## Consecuencias

- **Riesgo del orden de políticas ("la última que coincide gana"):** una excepción con un `from` demasiado amplio reabre lo que restringe una política anterior. Pasó en la primera versión: "cualquier `infrastructure/` puede usar `@repo/db` y Prisma" permitía a `provider-sim`, `web`, `integrations`, `domain`, etc. usar la base. Corregido acotando la excepción a `infrastructure/` de `api`, `worker` y `platform` (más `packages/db` y `packages/testing`). Por cada excepción debe existir una prueba negativa desde quien **no** debe beneficiarse de ella; la regresión se comprobó (15 pruebas fallan con el `from` antiguo).
- Un import prohibido rompe `pnpm lint`, `pnpm lint:boundaries` y el hook de edición.
- Los módulos externos de `platform` (NestJS, BullMQ, ioredis) son descriptivos: no se restringen con lista cerrada. Sí se restringen los de `domain` (ninguno), `contracts` (solo `zod`) y `observability` (pino, OpenTelemetry, Sentry y núcleo de Node).
- Las reglas de capas suponen que los módulos viven en `src/**/<módulo>/{domain,application,infrastructure,interface}`. Una carpeta con esos nombres fuera de un módulo se clasificaría como capa.
- **Guardas contra falsos verdes en las pruebas** (además de una prueba negativa por arista): cada `@repo/*` debe resolver como local; un `@repo/*` que no resuelve es error (política final); ninguna política puede tener listas de selectores vacías (el plugin captura el error de un `to: []` y la política simplemente no se evalúa, sin avisar en las pruebas); `APPS`/`PACKAGES` deben coincidir con las carpetas reales de `apps/` y `packages/` (un paquete no listado quedaría sin reglas, porque el plugin omite en silencio los archivos sin elemento).
- Categorías de archivo: `test` (`*.{spec,int-spec,e2e-spec}.ts`, `test/**`) y `config` (`*.config.{js,ts}` **solo en la raíz de cada app o paquete**: un `*.config.ts` anidado no escapa de las restricciones de su capa).
- Los globs de módulos cubren subrutas (`@prisma/**`, `@repo/**`): `@prisma/client/sql` o un `@repo/config/<subruta>` que no resuelve no pasan como externos permitidos.
- Las capas hexagonales se clasifican en `api`, `worker`, `provider-sim` y `packages/*`, no en `apps/web` (FSD): una carpeta `infrastructure/` en la web sigue sujeta a FSD.
- **Limitación conocida:** el plugin trata `import { type X }` (tipo en línea) como import de valor. Donde solo se permiten tipos (`db` → `domain`) hay que usar `import type { X }` o `export type { X } from`. Es un falso bloqueo, nunca un falso permiso; hay prueba que lo ancla.
- Revertir: quitar `createBoundariesConfig()` de `createBaseConfig`, la tarea `//#lint:boundaries` y las dos dependencias.

## Verificación

```bash
pnpm lint:boundaries
pnpm turbo run test --filter=@repo/config
pnpm lint
```
