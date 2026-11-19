# ADR-0005 — Paquetes internos compilados con `tsc` y condición `source`

| Campo | Valor |
| --- | --- |
| Estado | Aceptado (aprobado por el usuario el 2026-11-18, checkpoint de la sub-fase 0.7, decisión D3) |
| Fecha | 2026-11-18 |
| Decisores | Usuario (dueño del proyecto) |
| Sub-fase / fase | 0.7 (Fase 0) |
| Relacionado con | ADR-0001 (ESM, TypeScript 5.9), ADR-0002 (fronteras), `turbo.json` (tarea `build` con salida `dist/**`, aprobada en 0.2) |

## Contexto

`@repo/observability` es el primer paquete con código que consumirán las apps (`api` en la 0.8, `worker` en la 0.18) y las imágenes Docker (0.22, con `turbo prune` y `pnpm deploy`). Hay dos estrategias habituales:

- **Compilado:** cada paquete emite JavaScript y declaraciones a `dist/`; las apps importan `dist/`.
- **Sin compilar (just-in-time):** las apps importan el `.ts` del paquete y lo transforma su propio compilador.

Hechos que pesan: Node 24 quita tipos a `.ts`, pero **no dentro de `node_modules`** (que es donde quedan los paquetes en una imagen hecha con `pnpm deploy`); `tsc` con `rootDir` en una app falla si incluye `.ts` de otro paquete (TS6059); y `turbo.json` tenía `build` → `dist/**` con `typecheck`, `lint` y `test` dependiendo de `^build` (con esta decisión, `test` deja de depender de `^build`).

## Decisión

1. **Paquetes con lógica compilados con `tsc`** (`tsconfig.build.json`: `rootDir: src`, `outDir: dist`, sin `*.spec.ts`), con declaraciones y *source maps*. No se añade ninguna herramienta nueva.
2. **`exports` con tres condiciones, en este orden** (`types` antes que `source`, decisión del usuario):
   ```json
   ".": { "types": "./dist/index.d.ts", "source": "./src/index.ts", "default": "./dist/index.js" }
   ```
   - `types` → `dist/`: TypeScript (`tsc`, lint con tipos). Por eso `typecheck`, `lint`, `build`, `dev` y `test:int` dependen de `^build` en `turbo.json`.
   - `default` → `dist/`: Node en ejecución y las imágenes.
   - `source` → `src/`: solo la usan las herramientas que la piden:
     - el resolutor de las fronteras (`eslint-import-resolver-typescript`, `conditionNames: ['source', 'import', 'node', 'default']`, **sin `types`**, porque como `types` va antes elegiría `dist/`): `pnpm lint:boundaries` (en CI no depende de `build`) nunca ve un `@repo/*` sin resolver;
     - Vitest (`createVitestConfig`): `ssr.resolve.conditions` (entorno `node`) y `resolve.conditions` (entorno cliente) empiezan por `source`, así que las pruebas unitarias usan el código fuente de sus dependencias y la tarea `test` ya no depende de `^build`.
3. Excepción ya existente: `@repo/config` exporta configuración (`.js`, `.json`) y fábricas `.ts` que solo leen las herramientas (ADR-0001, "Correcciones").

## Alternativas consideradas

| Alternativa | Por qué se descarta |
| --- | --- |
| Paquetes sin compilar (`exports` → `.ts`) | Rompe en imágenes con `pnpm deploy` (sin quitado de tipos dentro de `node_modules`) y en las apps que compilan con `tsc` y `rootDir` |
| `types` → `src/index.ts` | Mismo problema de `rootDir` (TS6059) en las apps que emiten con `tsc` |
| `tsup`/`tsdown`/SWC para compilar paquetes | Herramienta nueva sin necesidad: `tsc` ya está y emite declaraciones |

## Consecuencias

- Antes de que una app pase `typecheck` o `lint`, o arranque, sus paquetes deben estar construidos: lo garantiza Turbo (`dependsOn: ["^build"]`); en desarrollo, `pnpm dev` (0.24) lo tendrá en cuenta. Las pruebas unitarias no lo necesitan (condición `source`).
- Cada paquete con lógica lleva `tsconfig.json` (chequeo, con pruebas) y `tsconfig.build.json` (emisión).
- Revertir: cambiar `exports` a `.ts` y quitar `build` del paquete.

## Verificación

```bash
pnpm turbo run build --filter=@repo/observability    # emite dist/ sin *.spec
pnpm lint:boundaries                                  # resuelve @repo/observability sin dist/ (condición source)
```
