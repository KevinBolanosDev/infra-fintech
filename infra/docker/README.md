# Infraestructura local (Docker Compose)

Perfil `infra`: PostgreSQL 17, Redis 8 y Mailpit, fijados por etiqueta y digest (ADR-0004). El almacenamiento S3 llega en la Fase 3.

## Uso

```bash
pnpm infra:up     # levanta y espera a que todo esté healthy
pnpm infra:down   # para y borra los contenedores; los datos se conservan
```

Equivale a `docker compose -f infra/docker/compose.yaml --env-file infra/docker/.env.example --profile infra up -d --wait` (o `down`).

> **`down -v` borra los volúmenes con todos los datos.** No hay script para eso a propósito; hazlo solo si de verdad quieres empezar de cero.

## Servicios

| Servicio | Puerto (solo `127.0.0.1`) | Comprobación |
| --- | --- | --- |
| `postgres` | 5432 | `pg_isready` |
| `redis` | 6379 | `redis-cli ping` → `PONG` (AOF y `noeviction` para BullMQ) |
| `mailpit` | 8025 (interfaz web) y 1025 (SMTP) | <http://localhost:8025> |

Los puertos se cambian en el archivo de entorno (`POSTGRES_PORT`, `REDIS_PORT`, `MAILPIT_UI_PORT`, `MAILPIT_SMTP_PORT`). Si tienes otros contenedores en 5432 o 6379 (por ejemplo `aios-postgres` y `aios-redis` de otro proyecto), páralos o cambia los puertos.

## Bases y roles

El script `postgres/init/01-roles-y-bases.sh` corre solo cuando el volumen está vacío (primer arranque).

| Rol | Para qué | Privilegios |
| --- | --- | --- |
| `fintech_owner` | Migraciones (`DATABASE_URL`) | Dueño de `fintech`, `provider_sim` y del esquema `public`; `CREATEDB` solo en local (base sombra de Prisma) |
| `fintech_app` | La aplicación (`APP_DATABASE_URL`) | Solo `SELECT`, `INSERT`, `UPDATE`, `DELETE` en las tablas de `fintech_owner`; no crea tablas ni esquemas |
| `fintech_readonly` | Consultas y soporte | Solo `SELECT` |
| `postgres` | Solo el arranque del contenedor | Superusuario |

`provider_sim` queda vacía y sin acceso para `fintech_app` ni `fintech_readonly`; su aislamiento de roles llega en la Fase 2.

## Valores de entorno

`.env.example` trae solo valores **sintéticos** de desarrollo. Para usar los tuyos, cópialo a `infra/docker/.env` (ignorado por git) y pásalo con `--env-file infra/docker/.env`. Cambiar contraseñas no afecta a un volumen ya inicializado.
