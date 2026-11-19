# ADR-0004 — Infraestructura local (Docker Compose) y almacenamiento S3 diferido

| Campo | Valor |
| --- | --- |
| Estado | Aceptado (aprobado por el usuario el 2026-11-18, checkpoint de la sub-fase 0.6) |
| Fecha | 2026-11-18 |
| Decisores | Usuario (dueño del proyecto) |
| Sub-fase / fase | 0.6 (Fase 0) |
| Relacionado con | D-09; P-01; ADR-0001 |

## Contexto

La sub-fase 0.6 levanta la infraestructura local con Docker Compose (perfil `infra`). El plan nombraba Postgres, Redis, MinIO y Mailpit. Hechos verificados el 2026-11-18:

- La edición comunitaria de MinIO se distribuye **solo como código fuente**: no hay binarios ni imágenes mantenidas (README de `minio/minio`; última etiqueta `RELEASE.2025-10-15T17-29-55Z`; el repositorio `minio/minio` de Docker Hub responde 404).
- En la Fase 0 nada usa almacenamiento S3: lo necesitan los recibos y certificados (Fase 3).
- Docker Engine 28.3.2 y Compose v2.39.1 disponibles dentro de WSL (P-01).

## Decisión

1. **Imágenes fijadas por etiqueta y digest multi-arquitectura** (`docker buildx imagetools inspect`):

| Servicio | Imagen |
| --- | --- |
| `postgres` | `postgres:17.12-bookworm@sha256:40865bc877a289da75963d97d72b59633f639fc5af7a4e856bfa3714cae5b536` |
| `redis` | `redis:8.8.4-alpine@sha256:1273af45b299d2b8b60d0e400d90aa6c2c5b1794f01d6a7ca60ff3ba6e65efb5` |
| `mailpit` | `axllent/mailpit:v1.34.0@sha256:23a2ef85bc50853ab3093645d1d64679afd8887e89da5e48a88940c172591a4e` |

   - PostgreSQL **17**: la versión mayor más segura de encontrar en Neon, Supabase y RDS para staging; Prisma genera UUIDv7 en el cliente, así que el `uuidv7()` nativo de la 18 no hace falta. Variante `bookworm` (glibc, colaciones iguales a los servicios gestionados).
   - Redis 8.8.4 con AOF y `maxmemory-policy noeviction` (BullMQ).
   - Renovate (0.26) mantendrá etiquetas y digests.
2. **Roles de PostgreSQL** (D-09), creados por `infra/docker/postgres/init/01-roles-y-bases.sh`: `fintech_owner` (dueño de bases y esquema, migraciones, `CREATEDB` solo en local), `fintech_app` (solo DML, sin `CREATE` en el esquema ni en la base), `fintech_readonly` (solo lectura) y `postgres` solo para el arranque. Bases `fintech` y `provider_sim` (vacía; el aislamiento de roles del simulador llega en la Fase 2). Los nombres conceptuales `owner`/`app`/`readonly` llevan el prefijo `fintech_` para no chocar con la palabra clave `OWNER` y dejar claro a qué base pertenecen.
3. **Puertos estándar solo en `127.0.0.1`** (5432, 6379, 8025, 1025), sobreescribibles desde el archivo de entorno.
4. **Almacenamiento S3 diferido a la Fase 3**: se elegirá el emulador entonces (candidato: RustFS, Apache-2.0); en producción irá S3 o R2.

## Alternativas consideradas

| Alternativa | Por qué se descarta |
| --- | --- |
| PostgreSQL 18 | Soporte en todos los proveedores gestionados de staging no verificado; no aporta nada necesario |
| Valkey 9 | Válido (BSD, compatible con BullMQ); se mantiene Redis porque es lo que fija el plan. Revisar si el Redis gestionado de producción es Valkey |
| Imagen *legacy* de MinIO o compilarlo desde el código | Sin mantenimiento o con carga de mantenimiento propia |
| RustFS, SeaweedFS o Garage ya en la Fase 0 | Elegir sin necesidad y con incertidumbre; se decide cuando haya un consumidor |
| Solo etiquetas, sin digest | Una etiqueta se puede reescribir; el digest hace la imagen inmutable |

## Consecuencias

- La 0.6 entrega tres servicios en lugar de cuatro y su criterio 3 deja de comprobar MinIO.
- El perfil `infra` sumará el emulador S3 en la Fase 3.
- Si existen otros contenedores locales en 5432/6379 (por ejemplo `aios-postgres`, `aios-redis` de otro proyecto), hay que pararlos o cambiar los puertos en el archivo de entorno.
- `down -v` borra los volúmenes con los datos: nunca sin confirmación explícita.
- El healthcheck de `postgres` usa TCP (`pg_isready -h 127.0.0.1`): el servidor temporal del init de la imagen arranca con `listen_addresses=''`, así que el contenedor no queda `healthy` hasta que terminan los scripts de `init/`.
- **Pendiente para sub-fases posteriores** (revisión de la 0.6):
  - Los *default privileges* dan DML a `fintech_app` sobre toda tabla de `fintech_owner` en `public`, incluida `_prisma_migrations`: revocarlo cuando exista (0.10) y aplicar el "solo inserción" de `audit_log` (0.15).
  - Las funciones conservan `EXECUTE` para `PUBLIC` por defecto: revisarlo con los triggers de la 0.15.
  - Endurecimiento opcional: quitar `CONNECT` de `PUBLIC` en las bases `postgres` y `template1`.
  - Redis local sin contraseña (solo `127.0.0.1`); en staging debe tenerla.

## Verificación

```bash
pnpm infra:up      # o docker compose -f infra/docker/compose.yaml --env-file infra/docker/.env.example --profile infra up -d --wait
docker compose -f infra/docker/compose.yaml --env-file infra/docker/.env.example --profile infra ps
```
