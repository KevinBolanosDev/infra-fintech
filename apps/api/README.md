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

## Errores y trazabilidad

- Todo error sale como `application/problem+json` (RFC 9457) con `code`, `details` y `request_id` (ADR-0008, esquema en `@repo/contracts`). Nunca se devuelven mensajes, pilas ni nombres internos; los 5xx son genéricos.
- Cada petición tiene `X-Request-Id` (el recibido si es un UUID válido; si no, uno nuevo), que vuelve en la respuesta y aparece en cada línea de log como `request_id`. `X-Correlation-Id` se propaga igual.
- Validación de entrada: DTOs con `createZodDto(esquema)` y el `ZodValidationPipe` global (400 `VALIDATION_FAILED` con un detalle por campo).
- Errores de negocio: `DomainError(code, mensajePúblico)`; el estado HTTP sale de `DOMAIN_ERROR_STATUS` (por defecto 422).

## Seguridad HTTP

`helmet` (cabeceras de seguridad, sin `x-powered-by`), CORS con lista blanca, límite de tamaño del cuerpo (413), `trust proxy` explícito, rutas de negocio en `/v1` y `/health` fuera del prefijo, cierre ordenado con `SIGTERM`.
