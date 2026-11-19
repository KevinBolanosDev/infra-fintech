# ADR-0007 — Compilación y recarga de las apps NestJS: `tsc` + `node --watch`

| Campo | Valor |
| --- | --- |
| Estado | Aceptado (decisión del usuario Q-2 de la sub-fase 0.8, 2026-11-18) |
| Fecha | 2026-11-18 |
| Decisores | Usuario (dueño del proyecto) |
| Sub-fase / fase | 0.8 (Fase 0); condiciona 0.18, 0.20, 0.22 y 0.24 (`docker compose watch`) |
| Relacionado con | ADR-0001 (ESM, TypeScript 5.9), ADR-0005 (paquetes compilados con `tsc`), D-10 = Express |

## Contexto

NestJS necesita los metadatos de decoradores (`emitDecoratorMetadata`) para su inyección de dependencias. El plan pide elegir en la 0.8 cómo se compila y recarga `apps/api` (y después `worker` y `provider-sim`), porque las imágenes (0.22) y `docker compose watch` (0.24) dependen de ello.

## Decisión

- **Compilación:** `tsc -p tsconfig.build.json` → `dist/` (sin pruebas), igual que los paquetes (ADR-0005). `tsc` emite los metadatos de decoradores de forma nativa.
- **Ejecución:** `node dist/main.js` (`start`).
- **Desarrollo** (`dev`, tarea persistente de Turbo): `tsc` una vez y luego, en paralelo, `tsc --watch --preserveWatchOutput` y `node --watch --env-file-if-exists=.env dist/main.js` (recarga nativa de Node 24; carga `apps/api/.env` si existe). Turbo pasa al proceso, con `passThroughEnv`, las variables de la API (`APP_ENV`, `HTTP_PORT`, `ALLOWED_ORIGINS`, `LOG_LEVEL`, `TRUST_PROXY`, `HTTP_BODY_LIMIT`).
- **Pruebas:** Vitest con SWC (perfil `nest` de `@repo/config`), que también emite metadatos. Las pruebas de integración del proceso (`test:int`) corren contra `dist/main.js`; por eso `test:int` depende de `build` en `turbo.json`.

## Alternativas consideradas

| Alternativa | Por qué se descarta |
| --- | --- |
| `nest start --watch` (`@nestjs/cli`) | Añade el CLI de Nest (y `@swc/cli` para compilar con SWC); no aporta nada que `tsc` + `node --watch` no cubran |
| SWC (`@swc/cli`) + `node --watch` | Más rápido, pero es una herramienta más y la emisión no comprueba tipos |
| `tsx watch` | Usa esbuild, que **no** emite `emitDecoratorMetadata`: rompe la inyección de dependencias de Nest |

## Consecuencias

- Un cambio en un paquete interno durante `dev` necesita recompilar ese paquete (su `dist/`); lo resolverá la 0.24 (`pnpm dev` y `docker compose watch`).
- El arranque de `dev` es algo más lento que con SWC; se revisará si se vuelve un problema.
- El script `dev` lanza `tsc --watch` en segundo plano dentro de un subshell: si el proceso se mata de forma no ordenada, ese `tsc` puede quedar huérfano (Ctrl+C manda la señal al grupo y los cierra a ambos). La 0.24 (`pnpm dev`, `docker compose watch`) debe revisarlo y, si hace falta, proponer un lanzador de procesos en paralelo.
- Verificado en la 0.8: `pnpm turbo run dev --filter=@repo/api` levanta la API y `curl /health` responde 200.

## Verificación

```bash
pnpm turbo run build --filter=@repo/api
APP_ENV=local pnpm turbo run dev --filter=@repo/api   # y en otra terminal: curl -i http://localhost:3000/health
```
