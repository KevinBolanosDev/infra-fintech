# apps/api — guía para el agente

> Aprobado por el usuario en el checkpoint de la sub-fase 0.8 (2026-11-18) y actualizado con la aprobación de la 0.9 (2026-11-19). Complementa el `CLAUDE.md` de la raíz; ante cualquier conflicto, manda el de la raíz. Cambios a este archivo requieren revisión humana.

API HTTP de la plataforma: NestJS 12 en ESM sobre Express (D-10), compilada con `tsc` (ADR-0007).

## Estructura

- `src/main.ts`: solo arranca (`bootstrap()`); no pongas lógica aquí.
- `src/bootstrap.ts`: escucha en `HTTP_PORT`; ante un error de arranque escribe un mensaje sin valores y sale con código 1.
- `src/create-app.ts`: `createApp(env, { extraModules, logDestination })` crea y configura la app **sin escuchar** (las pruebas la usan con Supertest). Orden fijo: `helmet` primero, sin `x-powered-by`, `trust proxy`, middleware de contexto de petición, CORS con lista blanca (expone `X-Request-Id`), cuerpo con límite, manejador de errores de Express (errores de `body-parser`), filtro global `AllExceptionsFilter`, `ZodValidationPipe` global, versionado `/v1`, `enableShutdownHooks`. `extraModules` es solo para pruebas y `createApp` lo rechaza fuera de `APP_ENV=test`.
- `src/common/`: piezas transversales HTTP (ADR-0008). `http/`: contexto de petición (`X-Request-Id`, `X-Correlation-Id`), `ProblemResponder` y `AllExceptionsFilter` (errores RFC 9457, `application/problem+json`). `validation/`: `createZodDto` y `ZodValidationPipe`. `errors/`: `DomainError`, provisional aquí hasta que pase a `@repo/domain` en la 0.12.
- `src/config/env.schema.ts`: esquema Zod del entorno. Toda variable nueva va aquí **y** en `.env.example` (valores sintéticos) **y** en `passThroughEnv` de la tarea `dev` de `turbo.json`.
- `src/health/`: `GET /health` (vivacidad, sin tocar dependencias), neutral a la versión.
- Módulos de negocio (Fase 1 en adelante): `src/modules/<nombre>/{domain,application,infrastructure,interface}`, una carpeta por módulo con sus cuatro capas (ADR-0003, `docs/architecture-rules.md` sección 2). `lint:boundaries` reconoce las capas por el nombre de la carpeta bajo `src/`, así que no uses esos cuatro nombres para otra cosa. Los módulos técnicos (`common`, `config`, `health`, `logging`, `lifecycle`) son planos.

## Reglas propias de la api

- Rutas de negocio siempre versionadas (`/v1/...`); solo `/health` y similares usan `VERSION_NEUTRAL`.
- CORS: nunca `*`; los orígenes salen de `ALLOWED_ORIGINS`.
- Configuración solo desde `ConfigService` (`config.get('app')`) o el `AppConfig` validado; nunca `process.env` directo fuera de `bootstrap.ts`.
- Logs con el logger de `@repo/observability` (vía `NestLogger`): registra identificadores, nunca datos personales; en `APP_ENV=test` la hora es fija.
- Nada de `Date.now()`/`new Date()`: hora de negocio con `ClockService` (llega en la 0.12).
- Inyección por constructor con tipos de clase importados como **valor** (no `import type`), para que existan los metadatos del decorador.
- Todo error sale por `ProblemResponder` (lanza una excepción o un `DomainError`); nunca respondas un error a mano con `res.status(...)`. El cuerpo público nunca lleva el mensaje de una excepción interna.
- DTO de entrada con `createZodDto(schema)` (esquemas en `@repo/contracts`) e importados como **valor**: con `import type` o una interfaz no hay metadatos y el pipe deja pasar el cuerpo **sin validar**.

## Pruebas

- Unitarias junto al archivo (`src/**/*.spec.ts`) y e2e en proceso con Supertest (`test/e2e/*.e2e-spec.ts`): `pnpm turbo run test --filter=@repo/api` (85 % de líneas).
- Integración contra `dist/main.js` (`test/integration/*.int-spec.ts`): `pnpm turbo run test:int --filter=@repo/api` (Turbo compila antes).
- Las pruebas que necesitan Nest importan `reflect-metadata` primero.
- Cada endpoint que recibe cuerpo o parámetros lleva una prueba e2e con una entrada inválida que espere 400 `VALIDATION_FAILED` (así se detecta un DTO que no valida).
- Módulos y controladores solo de pruebas en `test/support/` (fuera de `tsconfig.build.json`); se cargan con `createApp(env, { extraModules })` y nunca desde `bootstrap()`.

## Comandos

```bash
pnpm turbo run lint typecheck test --filter=@repo/api
pnpm turbo run test:int --filter=@repo/api
APP_ENV=local pnpm turbo run dev --filter=@repo/api   # o copia .env.example a .env
```
