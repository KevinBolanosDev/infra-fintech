# apps/api — guía para el agente

> Aprobado por el usuario en el checkpoint de la sub-fase 0.8 (2026-11-18). Complementa el `CLAUDE.md` de la raíz; ante cualquier conflicto, manda el de la raíz. Cambios a este archivo requieren revisión humana.

API HTTP de la plataforma: NestJS 12 en ESM sobre Express (D-10), compilada con `tsc` (ADR-0007).

## Estructura

- `src/main.ts`: solo arranca (`bootstrap()`); no pongas lógica aquí.
- `src/bootstrap.ts`: escucha en `HTTP_PORT`; ante un error de arranque escribe un mensaje sin valores y sale con código 1.
- `src/create-app.ts`: `createApp(env)` crea y configura la app **sin escuchar** (las pruebas la usan con Supertest). Orden fijo: `helmet` primero, sin `x-powered-by`, `trust proxy`, límite de cuerpo, CORS con lista blanca, versionado `/v1`, `enableShutdownHooks`.
- `src/config/env.schema.ts`: esquema Zod del entorno. Toda variable nueva va aquí **y** en `.env.example` (valores sintéticos) **y** en `passThroughEnv` de la tarea `dev` de `turbo.json`.
- `src/health/`: `GET /health` (vivacidad, sin tocar dependencias), neutral a la versión.
- Módulos de negocio (Fase 1 en adelante): `src/modules/<nombre>/{domain,application,infrastructure,interface}`, una carpeta por módulo con sus cuatro capas (ADR-0003, `docs/architecture-rules.md` sección 2). `lint:boundaries` reconoce las capas por el nombre de la carpeta bajo `src/`, así que no uses esos cuatro nombres para otra cosa. Los módulos técnicos (`config`, `health`, `logging`, `lifecycle`) son planos.

## Reglas propias de la api

- Rutas de negocio siempre versionadas (`/v1/...`); solo `/health` y similares usan `VERSION_NEUTRAL`.
- CORS: nunca `*`; los orígenes salen de `ALLOWED_ORIGINS`.
- Configuración solo desde `ConfigService` (`config.get('app')`) o el `AppConfig` validado; nunca `process.env` directo fuera de `bootstrap.ts`.
- Logs con el logger de `@repo/observability` (vía `NestLogger`): registra identificadores, nunca datos personales; en `APP_ENV=test` la hora es fija.
- Nada de `Date.now()`/`new Date()`: hora de negocio con `ClockService` (llega en la 0.12).
- Inyección por constructor con tipos de clase importados como **valor** (no `import type`), para que existan los metadatos del decorador.

## Pruebas

- Unitarias junto al archivo (`src/**/*.spec.ts`) y e2e en proceso con Supertest (`test/e2e/*.e2e-spec.ts`): `pnpm turbo run test --filter=@repo/api` (85 % de líneas).
- Integración contra `dist/main.js` (`test/integration/*.int-spec.ts`): `pnpm turbo run test:int --filter=@repo/api` (Turbo compila antes).
- Las pruebas que necesitan Nest importan `reflect-metadata` primero.

## Comandos

```bash
pnpm turbo run lint typecheck test --filter=@repo/api
pnpm turbo run test:int --filter=@repo/api
APP_ENV=local pnpm turbo run dev --filter=@repo/api   # o copia .env.example a .env
```
