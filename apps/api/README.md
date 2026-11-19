# @repo/api

API HTTP de la plataforma: NestJS 12 (ESM, Express), compilada con `tsc` (ADR-0007).

```bash
pnpm turbo run dev --filter=@repo/api          # requiere APP_ENV (o apps/api/.env a partir de .env.example)
curl -i http://localhost:3000/health           # {"status":"ok"}
pnpm turbo run lint typecheck test test:int --filter=@repo/api
```

## Variables de entorno

| Variable | Por defecto | Descripción |
| --- | --- | --- |
| `APP_ENV` | (obligatoria) | `local`, `test`, `staging`, `sandbox` o `production` |
| `HTTP_PORT` | `3000` | Puerto HTTP (`0` = uno libre) |
| `ALLOWED_ORIGINS` | vacío | Orígenes CORS permitidos, separados por comas (`http(s)://host[:puerto]`): nunca `*`, ni ruta, ni barra final. Fuera de `local` y `test`, solo `https://` y nunca `localhost`, `127.0.0.1` ni `::1` |
| `LOG_LEVEL` | `info` | `fatal` … `trace` o `silent` |
| `TRUST_PROXY` | `false` | `false` o número de proxies de confianza (1 a 10) |
| `HTTP_BODY_LIMIT` | `100kb` | Tamaño máximo del cuerpo (`b`, `kb`, `mb`) |

Una variable ausente o inválida impide el arranque con un mensaje que nombra la variable, nunca su valor, y código de salida 1.

## Seguridad HTTP

`helmet` (cabeceras de seguridad, sin `x-powered-by`), CORS con lista blanca, límite de tamaño del cuerpo (413), `trust proxy` explícito, rutas de negocio en `/v1` y `/health` fuera del prefijo, cierre ordenado con `SIGTERM`.
