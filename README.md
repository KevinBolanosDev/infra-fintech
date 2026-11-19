# fintech-arriendos

Plataforma que orquesta cobros mensuales de arriendo por Bre-B, con ledger propio, recibos, score y certificados. Nunca custodia dinero. El MVP corre con proveedores simulados.

Estado: Fase 0 (fundaciones) en curso. Plan de la fase: [`docs/fase-0-plan-de-implementacion.md`](docs/fase-0-plan-de-implementacion.md).

## Prerrequisitos

| Herramienta | Versión | Notas |
| --- | --- | --- |
| Node.js | `24.22.3` (ver `.nvmrc`) | Con nvm: `nvm install && nvm use` |
| pnpm | `12.18.0` (ver `packageManager` en `package.json`) | Debe ser el pnpm de Linux: `npm install -g pnpm@12.18.0` con el Node de nvm activo. En WSL, el `pnpm` de Windows (`/mnt/c/...`) no sirve: instala binarios de Windows. Comprueba que `which pnpm` apunte a `~/.nvm/...` |
| Docker + Docker Compose | Docker Desktop con integración WSL activada | Necesario desde la sub-fase 0.6. Comprueba con `docker version` dentro de WSL |

El repositorio debe vivir en el sistema de archivos de Linux (por ejemplo `~/proyectos`), no en `/mnt/c`.

## Primeros pasos

```bash
nvm use
pnpm install --frozen-lockfile
pnpm infra:up      # PostgreSQL, Redis y Mailpit (ver infra/docker/README.md)
```

## Integración continua

`.github/workflows/ci.yml` repite en GitHub Actions los controles locales, en jobs separados: `Lint` (incluye `lint:root` y formato), `Boundaries (lint:boundaries)`, `Typecheck`, `Tests`, `Build` y `Secrets (gitleaks)`. En un PR, las tareas por paquete corren solo en lo afectado (`--affected`); las de la raíz y `main` corren completas. Node y pnpm salen de `.nvmrc` y `packageManager` (`.github/actions/setup`). La caché remota de Turbo (autoalojada, D-08) se activa solo en los push a `main` y si el repositorio define `TURBO_API`, `TURBO_TEAM` y el secreto `TURBO_TOKEN`; en los PR nunca se expone el token.

Falsos positivos de gitleaks: se ignoran uno a uno en `.gitleaksignore` por su huella exacta (`<commit>:<archivo>:<regla>:<línea>`), nunca por ruta ni por regla completa, y cada entrada se anota en la bitácora del plan.

Equivalente local:

```bash
pnpm lint:format && pnpm turbo run lint lint:root lint:boundaries typecheck test build
```

## Estructura

```
apps/      api · worker · provider-sim · web
packages/  domain · contracts · api-client · db · integrations · observability · testing · ui · config
infra/docker/
docs/      plan maestro, plan de la Fase 0, reglas de arquitectura y ADRs (docs/adr/)
```

## Documentación

- Plan maestro: [`docs/plan-de-desarrollo-plataforma-fintech-de-arriendos-(MVP-y-escala).md`](<docs/plan-de-desarrollo-plataforma-fintech-de-arriendos-(MVP-y-escala).md>)
- Reglas de dependencia: [`docs/architecture-rules.md`](docs/architecture-rules.md)
- Decisiones de arquitectura: [`docs/adr/`](docs/adr/README.md)
