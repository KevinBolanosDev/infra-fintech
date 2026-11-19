#!/usr/bin/env bash
# Roles y bases del entorno local (sub-fase 0.6, D-09). Lo ejecuta la imagen oficial de PostgreSQL
# una sola vez, al inicializar un volumen vacío. Cambiarlo no afecta a un volumen ya creado.
#
# Roles:
#   fintech_owner    dueño de las bases y del esquema; corre las migraciones. CREATEDB solo en local
#                    (base sombra de `prisma migrate dev`).
#   fintech_app      la aplicación: solo DML (SELECT/INSERT/UPDATE/DELETE); no puede crear tablas.
#                    La restricción "solo inserción" de audit_log llega en la 0.15 (permisos + trigger).
#   fintech_readonly solo lectura.
#   postgres         superusuario, solo para este arranque.
# Bases: `fintech` (plataforma) y `provider_sim` (vacía; su aislamiento de roles llega en la Fase 2).
set -euo pipefail

: "${FINTECH_OWNER_PASSWORD:?falta FINTECH_OWNER_PASSWORD}"
: "${FINTECH_APP_PASSWORD:?falta FINTECH_APP_PASSWORD}"
: "${FINTECH_READONLY_PASSWORD:?falta FINTECH_READONLY_PASSWORD}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v owner_password="$FINTECH_OWNER_PASSWORD" \
  -v app_password="$FINTECH_APP_PASSWORD" \
  -v readonly_password="$FINTECH_READONLY_PASSWORD" <<'SQL'
CREATE ROLE fintech_owner LOGIN CREATEDB PASSWORD :'owner_password';
CREATE ROLE fintech_app LOGIN PASSWORD :'app_password';
CREATE ROLE fintech_readonly LOGIN PASSWORD :'readonly_password';

CREATE DATABASE fintech OWNER fintech_owner;
CREATE DATABASE provider_sim OWNER fintech_owner;

REVOKE ALL ON DATABASE fintech FROM PUBLIC;
GRANT CONNECT ON DATABASE fintech TO fintech_app, fintech_readonly;
REVOKE ALL ON DATABASE provider_sim FROM PUBLIC;

\connect fintech

ALTER SCHEMA public OWNER TO fintech_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO fintech_app, fintech_readonly;

ALTER DEFAULT PRIVILEGES FOR ROLE fintech_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fintech_app;
ALTER DEFAULT PRIVILEGES FOR ROLE fintech_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO fintech_app;
ALTER DEFAULT PRIVILEGES FOR ROLE fintech_owner IN SCHEMA public
  GRANT SELECT ON TABLES TO fintech_readonly;
SQL
