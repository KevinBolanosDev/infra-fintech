# ADR-0001 — Toolchain y versiones

| Campo | Valor |
| --- | --- |
| Estado | Aceptado (aprobado por el usuario el 2026-11-12, checkpoint de la sub-fase 0.1) |
| Fecha | 2026-11-12 |
| Decisores | Usuario (dueño del proyecto) |
| Sub-fase / fase | 0.1 (Fase 0) |
| Relacionado con | D-01, D-02, D-03 y D-04 del plan de la Fase 0; sección 3.4 (matriz de versiones) |

## Contexto

El repositorio parte vacío (solo estructura de carpetas). Antes de escribir código hay que fijar el entorno de ejecución, el gestor de paquetes, el sistema de módulos y las versiones mayores de las piezas que se instalan durante la Fase 0, porque cambiarlas después obliga a tocar todos los paquetes.

Hechos verificados el 2026-11-12:

- **Calendario de Node.js** (`nodejs/Release`, `schedule.json`): Node 22 en mantenimiento desde 2025-10-21, fin de vida 2027-04-30. Node 24 LTS desde 2025-10-28, **en mantenimiento desde 2026-10-20**, fin de vida **2028-04-30**. Node 26 LTS activo desde 2026-10-28, fin de vida 2029-04-30.
- **Registro de npm** (`npm view`): ver la tabla de versiones de abajo.
- **pnpm 12**: los ajustes del workspace viven en `pnpm-workspace.yaml`; los scripts de instalación de dependencias están bloqueados por defecto (`strictDepBuilds: true`) y se permiten con el mapa `allowBuilds` (Context7, documentación de pnpm v12.15.0). El campo `packageManager` fija la versión exacta y pnpm cambia a ella si se ejecuta otra (`pmOnFail: download` por defecto). En pnpm 11+ desaparecieron `managePackageManagerVersions`, `useNodeVersion` y similares.
- **NestJS 12** (`@nestjs/core@12.5.0`) es solo ESM; la serie 11 quedó con la etiqueta `legacy` (`11.2.10`).
- **typescript-eslint 8.72.2** declara `typescript >=4.8.4 <6.1.0`: TypeScript 7 (`latest` = 7.0.2) no es utilizable con el lint.
- **Prisma**: la etiqueta `latest` de `prisma` apunta a `8.0.0-rc.33`. La serie 7 vigente es `7.10.1`.

## Decisión

1. **Node.js 24** (D-01 = B). `.nvmrc` = `v24.22.3` (versión exacta, la instalada y la que usarán las imágenes Docker y CI). `engines.node` = `>=24.22.3 <25`: exige como mínimo la versión fijada y no rompe la instalación por un parche posterior de la misma serie.
2. **pnpm 12.18.0** fijado en `packageManager` (`pnpm@12.18.0`, `latest` del registro). Workspace `apps/*` y `packages/*`. `engineStrict: true` en `pnpm-workspace.yaml`: instalar con un Node fuera de `engines.node` falla (no solo avisa). En WSL, pnpm se instala del lado Linux con `npm install -g pnpm@12.18.0` sobre el Node 24 de nvm (opción A de Q-1, 2026-11-12); el pnpm de Windows no se usa.
3. **Scripts de instalación**: lista explícita en `allowBuilds` de `pnpm-workspace.yaml`: `@swc/core`, `prisma`, `@prisma/engines` (`esbuild` se retiró en 0.3, ver "Correcciones"). Todo lo demás sigue bloqueado y `strictDepBuilds` queda en su valor por defecto (`true`), así que una dependencia nueva con scripts hace fallar la instalación hasta que alguien la revise.
4. **NestJS 12 en ESM + TypeScript 5.9.x** (D-02 = A). Todo el monorepo es ESM: `"type": "module"` en la raíz y en cada paquete, `module`/`moduleResolution` `Node16` e imports relativos con extensión `.js`. Las skills del repositorio (escritas para Nest 11, Bun y Jest) se adaptan a Nest 12, pnpm, Node y Vitest.
5. **Scope de paquetes internos `@repo/*`** (D-03 = A).
6. **Versiones exactas** en todas las dependencias (sin `^` ni `~`). Prisma siempre con versión explícita de la serie 7; nunca la etiqueta `latest`. Pasar a Prisma 8 exige un ADR propio.
7. **Git** (D-04 = d): el usuario hace todos los commits y `push`; el agente implementador nunca commitea.

### Versiones fijadas (registro de npm, 2026-11-12)

Solo se instala cada pieza en la sub-fase que la necesita (criterio "ninguna dependencia innecesaria"); esta tabla fija desde ya la versión de referencia.

| Pieza | Versión | Sub-fase | Observación |
| --- | --- | --- | --- |
| Node.js | `24.22.3` | 0.1 | `.nvmrc`, `engines`, imágenes Docker y CI |
| pnpm | `12.18.0` | 0.1 | `packageManager`. `next-12` = 12.20.0 (no se usa) |
| TypeScript | `5.9.3` | 0.2 | 6.0.3 y 7.0.2 descartadas (ver alternativas) |
| turbo | `2.11.11` | 0.2 | |
| eslint | `10.14.0` | 0.2 | Peer de typescript-eslint: `^8.57 \|\| ^9 \|\| ^10` |
| typescript-eslint | `8.72.2` | 0.2 | |
| prettier | `3.10.0` | 0.2 | Corregido el 2026-11-12 (antes `3.10.1`, ver "Correcciones") |
| @eslint/js | `10.0.1` | 0.2 | `js.configs.recommended`; en ESLint 10 se instala aparte. Añadido en 0.2 |
| eslint-plugin-simple-import-sort | `14.0.0` | 0.2 | Imports y exports ordenados con `--fix`. Añadido en 0.2 |
| @types/node | `24.19.2` | 0.2 | Tipos de Node 24 para el perfil `tsconfig/node.json`. Añadido en 0.2 |
| vitest, @vitest/coverage-v8 | `5.1.0` | 0.3 | Decidido en 0.3 (ver "Correcciones"); 4.1.12 descartada |
| vite | `8.3.8` | 0.3 | Dependencia par de Vitest 5, fijada explícitamente. Usa rolldown/oxc; ya no trae esbuild |
| unplugin-swc | `2.0.0` | 0.3 | Transforma TypeScript con SWC en Vitest (desactiva `oxc` de Vite) |
| @swc/core | `1.16.22` | 0.3 | En `allowBuilds` (script `postinstall`) |
| ~~esbuild~~ | — | — | Retirado de `allowBuilds` en 0.3: Vite 8 no lo instala |
| eslint-plugin-boundaries | `7.4.3` | 0.4 | Reglas de dependencia (ADR-0002). Instalada cuando cumplió la espera de 24 h, sin excepción |
| pino | `10.4.0` | 0.7 | Dependencia de `@repo/observability` (fijada por el plan) |
| pino-pretty | `13.2.0` | 0.7 | Solo desarrollo, en `@repo/observability` |
| @nestjs/common, @nestjs/core, @nestjs/platform-express, @nestjs/testing | `12.5.1` | 0.8 | Express (D-10). `@nestjs/testing` solo desarrollo |
| @nestjs/config | `12.1.1` | 0.8 | |
| reflect-metadata, rxjs | `0.2.2`, `7.8.2` | 0.8 | |
| zod | `4.6.7` | 0.8 | Validación del entorno de `apps/api` |
| helmet | `8.3.0` | 0.8 | |
| supertest, @types/supertest, @types/express | `7.3.2`, `7.2.1`, `5.0.6` | 0.8 | Solo desarrollo |
| eslint-import-resolver-typescript | `4.4.5` | 0.4 | Resolutor de imports para las fronteras (ADR-0002). `unrs-resolver: false` en `allowBuilds` |
| @nestjs/core, @nestjs/common | `12.5.0` | 0.8 | Solo ESM; engines `>= 20` |
| prisma, @prisma/client, @prisma/adapter-pg | `7.10.1` | 0.10 | `prisma` y `@prisma/engines` en `allowBuilds`. `prisma` en la raíz (desarrollo); cliente y adaptador en `@repo/db` (ADR-0009). `pg` y `@types/pg` `8.23.1` entran como dependencias del adaptador |

Las demás versiones de la matriz 3.4 del plan (`nestjs-pino`, `@sentry/nestjs`, `bullmq`, `zod`, etc.) se vuelven a verificar contra el registro en la sub-fase que las instala y se anotan en el ADR que corresponda.

## Alternativas consideradas

| Alternativa | Por qué se descarta |
| --- | --- |
| Node 22 | Fin de vida 2027-04-30, en plena Fase 5 del plan. |
| Node 26 (LTS activo desde 2026-10-28) | No se eligió en D-01, confirmado por el usuario el 2026-11-12. Al fijar este ADR, Node 24 ya está en mantenimiento (desde 2026-10-20); su fin de vida (2028-04-30) cubre el horizonte del plan. **El paso a Node 26 LTS se evaluará en un ADR posterior.** |
| Corepack (`corepack enable pnpm`) para proveer pnpm | Node 25+ ya no incluye Corepack y pnpm 11+ ya cambia solo a la versión de `packageManager`. |
| Instalador independiente de pnpm (`get.pnpm.io`) | Válido, pero añade un mecanismo más; `npm install -g` sobre nvm es suficiente. |
| NestJS 11 (CJS, `legacy`) | Proyecto nuevo; Prisma 7 y Better Auth son ESM-first y la serie 11 ya está en `legacy`. |
| TypeScript 7.0.2 | typescript-eslint 8.72.2 solo soporta `<6.1.0`. |
| TypeScript 6.0.3 | NestJS 12 se desarrolla con TypeScript 5.9.3; 6.x no aporta nada necesario y añade riesgo de compatibilidad con decoradores y herramientas. |
| Prisma 8 (`8.0.0-rc.33`) | Es un RC; `CLAUDE.md` prohíbe actualizar sin ADR. |
| Scope `@fintech/*` | Depende del nombre del producto, aún pendiente; renombrar después es un cambio masivo. |
| `onlyBuiltDependencies` / `.npmrc` | Sintaxis de pnpm 10; en pnpm 12 el ajuste vigente es `allowBuilds` en `pnpm-workspace.yaml`. No hace falta `.npmrc`. |
| Permitir todos los scripts (`strictDepBuilds: false` o sin lista) | Abre la puerta a scripts de instalación maliciosos en la cadena de suministro. |

## Consecuencias

- Todo el código nace en ESM: imports relativos con `.js` y configuración de herramientas compatible con ESM (Vitest + `unplugin-swc` con metadatos de decoradores se valida en 0.3 y 0.8).
- Cada dependencia con scripts de instalación nueva requiere una entrada revisada en `allowBuilds`.
- No se puede usar el pnpm de Windows desde WSL: es `pnpm.exe` (`process.platform = win32`), instala binarios nativos de Windows y usa el almacén de Windows por rutas UNC. `which pnpm` debe apuntar a `~/.nvm/versions/node/v24.22.3/bin/pnpm`. Cada versión nueva de Node instalada con nvm necesita su propio `npm install -g pnpm@<versión>`.
- `pnpm-lock.yaml` contiene `packageManagerDependencies` (pnpm 12.18.0 y sus binarios `@pnpm/exe.*` de todas las plataformas): es independiente de la plataforma y se comprobó que es idéntico al que genera el pnpm de Linux desde cero.
- Revertir D-02 (volver a CJS) obligaría a tocar todos los `package.json`, `tsconfig` e imports: es la decisión más cara de deshacer.

## Correcciones

| Fecha | Sub-fase | Cambio | Motivo |
| --- | --- | --- | --- |
| 2026-11-12 | 0.2 | `prettier` `3.10.1` → `3.10.0` | `3.10.1` se publicó el 2026-11-12 07:06 UTC y no cumplía la espera mínima de pnpm 12 (`minimumReleaseAge` = 1440 min por defecto). pnpm añadió por su cuenta `minimumReleaseAgeExclude: [prettier@3.10.1]`; el usuario decidió no eximirla, bajar a `3.10.0` y quitar la excepción. Política: no se crean excepciones a `minimumReleaseAge` sin decisión explícita |
| 2026-11-12 | 0.2 | Añadidos `@eslint/js`, `eslint-plugin-simple-import-sort` y `@types/node` | Decisiones del usuario Q-1 a Q-3 de la sub-fase 0.2. Alternativas descartadas para ordenar imports: `eslint-plugin-import-x` (requiere resolver de TypeScript, más lento, solapa con las fronteras de 0.4), `eslint-plugin-perfectionist` (más opinable), plugin de Prettier (fuera de ESLint, contra lo que pide el plan) |
| 2026-11-13 | 0.3 | **Vitest 5.1.0** (con `@vitest/coverage-v8` 5.1.0 y `vite` 8.3.8 fijado) | Decisión del usuario (Q-1/Q-2 de 0.3). Vitest 4.1.12 (línea de mantenimiento `V4`) descartada para no migrar de versión mayor en plena Fase 1–2. Requisitos de Vitest 5 (Context7, guía de migración 5.0): Node ≥22.12 y Vite ≥6.4 como dependencia par. **Prueba que la respalda:** `pnpm test` en `@repo/config` (21 pruebas, cobertura v8 al 100 %), umbral incumplido → `ERROR: Coverage for lines (76.19%) does not meet global threshold (80%)` con código 1, y una prueba que transforma una clase decorada con las opciones SWC del perfil Nest y comprueba que emite `design:paramtypes` en ESM |
| 2026-11-13 | 0.3 | `unplugin-swc` 2.0.0 + `@swc/core` 1.16.22; `esbuild` fuera de `allowBuilds` | Decisión del usuario (Q-3/Q-4 de 0.3), como fija el plan. Alternativa descartada: el transformador nativo de Vite 8 (oxc), sin verificar con metadatos de decoradores de Nest. `esbuild` no aparece en el árbol instalado (Vite 8 usa rolldown/oxc), así que su entrada sobraba |
| 2026-11-13 | 0.3 | Excepción a "imports relativos con `.js`" (decisión 4) dentro de `packages/config/vitest/` | Las fábricas de Vitest se consumen como `.ts` sin compilar y Node 24 las carga quitando los tipos: `./base.js` no existe y `./base.ts` rompe el `tsc` de los consumidores (TS5097). Entre ellas se importan por el export del propio paquete (`@repo/config/vitest/base`) y el tsconfig de `@repo/config` exige `erasableSyntaxOnly`. Las dependencias de `@repo/config` (ESLint, Vitest, SWC) se resuelven desde la raíz, sin `peerDependencies`, por la decisión de instalar el toolchain una sola vez en la raíz |

## Verificación

```bash
node -v                               # v24.22.3, igual a .nvmrc y dentro de engines.node
pnpm -v                               # 12.18.0, igual a packageManager
pnpm install --frozen-lockfile        # código 0 en un clon limpio
```
