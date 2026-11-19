# ADR-0008 — Contrato público de errores (RFC 9457) y validación con Zod sin `nestjs-zod`

| Campo | Valor |
| --- | --- |
| Estado | Aceptado (decisiones del usuario D-11, Q-2, Q-3 y Q-4 de la sub-fase 0.9, 2026-11-19) |
| Fecha | 2026-11-19 |
| Decisores | Usuario (dueño del proyecto) |
| Sub-fase / fase | 0.9 (Fase 0) |
| Relacionado con | D-11; ADR-0003 (capas); ADR-0005 (paquetes compilados); `@repo/contracts`; `@repo/observability` |

## Contexto

Todo error de la API debe salir con un formato público único (contrato con la web y los proveedores), trazable por `request_id` y sin filtrar internos. El plan pedía validar con `nestjs-zod` usando los esquemas de `@repo/contracts`, pero **`nestjs-zod` 5.6.0 (la última, 2026-11-08) declara `@nestjs/common` `^10 || ^11`: no admite Nest 12**.

## Decisión

### 1. Cuerpo de error (D-11), `Content-Type: application/problem+json`

Esquema en `@repo/contracts` (`problemDetailsSchema`):

| Campo | Contenido |
| --- | --- |
| `type` | `urn:problem-type:<code en minúsculas con guiones>` (por ejemplo `urn:problem-type:not-found`): estable y sin depender del dominio del producto |
| `title` | Resumen fijo por código, en español |
| `status` | Estado HTTP (400–599) |
| `detail` | Explicación de esta ocurrencia; **nunca** el mensaje de una excepción interna (salvo el mensaje público de un `DomainError`) |
| `instance` | Ruta de la petición **sin query string** |
| `code` | Extensión: código estable en MAYÚSCULAS_CON_GUION_BAJO |
| `details` | Extensión: `[{ field, code, message }]`, **siempre presente** (vacío si no aplica) |
| `request_id` | Extensión (`snake_case`): el mismo que la cabecera `X-Request-Id` |

### 2. Mapeo y registro

| Origen | Estado | `code` |
| --- | --- | --- |
| Ruta inexistente | 404 | `NOT_FOUND` |
| Validación (Zod) | 400 | `VALIDATION_FAILED`, con `details` por campo |
| JSON mal formado (`body-parser`) | 400 | `MALFORMED_BODY` |
| Cuerpo demasiado grande (`body-parser`) | 413 | `PAYLOAD_TOO_LARGE` |
| Otra `HttpException` | La suya | Según el estado (`FORBIDDEN`, `CONFLICT`…; si no hay, `HTTP_<estado>`), con texto fijo |
| `DomainError` | `DOMAIN_ERROR_STATUS[code]`, por defecto 422 | El suyo |
| Cualquier otro error | 500 | `INTERNAL_ERROR`, texto genérico |

- Registro: 5xx con nivel `error` y el error completo (enmascarado por `@repo/observability`); 4xx con nivel `info`, sin pila. El `request_id` lo añade el logger desde el contexto.
- Dos puntos de entrada usan el mismo `ProblemResponder`: el filtro global de Nest (`AllExceptionsFilter`) y un manejador de errores de Express para los errores de `body-parser`, que ocurren antes del enrutado de Nest.

### 3. Contexto de petición

Middleware de Express (después de `helmet`, antes de CORS y del cuerpo): `X-Request-Id` recibido si es un UUID válido (si no, `crypto.randomUUID()`), `X-Correlation-Id` válido o el mismo `request_id`, IP (según `trust proxy`) y agente de usuario en el contexto de ejecución de `@repo/observability` (`userAgent` añadido como campo opcional; el logger no escribe IP ni agente). `X-Request-Id` vuelve en la respuesta y CORS lo expone.

### 4. Validación sin `nestjs-zod`

`createZodDto(schema)` (clase con el esquema como dato estático) + `ZodValidationPipe` global: si el tipo del parámetro es un DTO de Zod, valida y devuelve el valor parseado; si no, lo deja pasar. Unas 40 líneas propias, con pruebas. **Si `nestjs-zod` publica soporte para Nest 12, se puede migrar**: los esquemas siguen en `@repo/contracts`.

### 5. `DomainError`

Clase base con `code` y mensaje público, sin HTTP. Provisionalmente en `apps/api/src/common/errors/domain-error.ts`; **pasa a `@repo/domain` en la 0.12**, cuando exista el paquete.

## Alternativas consideradas

| Alternativa | Por qué se descarta |
| --- | --- |
| `type: "about:blank"` | Obliga al cliente a distinguir solo por `code`; el `urn:` da un tipo estable por problema desde el primer día |
| `nestjs-zod` 5.6.0 pese a la dependencia par | No declara soporte para Nest 12; riesgo sin necesidad |
| `class-validator` | Duplicaría los esquemas de `@repo/contracts` |
| `DomainError` ya en `@repo/domain` | Adelanta trabajo de la 0.12 |

## Consecuencias

- Cambiar el cuerpo de error es un cambio incompatible para la web y los proveedores.
- Los mensajes de validación de `details[].message` son los de Zod (en inglés); la web debe apoyarse en `code` y `field`.
- El controlador de errores de prueba vive en `apps/api/test/support/` (fuera de `tsconfig.build.json`): nunca llega a `dist/`, y `bootstrap()` no lo registra (verificado con pruebas e2e y de integración sobre `dist/`). Además, `createApp` rechaza `extraModules` fuera de `APP_ENV=test`.
- Una `HttpException` con estado fuera de 400–599 (por ejemplo 302) se responde como 500 `INTERNAL_ERROR`: un problem+json nunca lleva un estado que no sea de error.
- `request_id` del error: el del contexto de ejecución; si faltara, la cabecera `X-Request-Id` que ya puso el middleware (nunca un id distinto). Se verificó con cuerpos troceados y peticiones concurrentes sobre un servidor real que el contexto sobrevive a la lectura asíncrona de `body-parser` (`test/e2e/context-chunked.e2e-spec.ts`).

## Limitaciones conocidas

- **El pipe falla abierto si no hay metadatos de tipo.** `ZodValidationPipe` solo valida cuando el tipo del parámetro es una clase creada con `createZodDto`. Si el DTO se importa con `import type` o se declara como interfaz, no hay metadatos en tiempo de ejecución y el valor pasa **sin validar**. Por eso los DTO se importan como valor (regla de `apps/api/CLAUDE.md`), y cada endpoint debe tener una prueba que envíe un cuerpo inválido.
- **Los logs de 5xx guardan el mensaje y la pila del error tal como vienen.** `@repo/observability` enmascara por nombre de campo, no el texto libre de un mensaje. Un error de una librería (por ejemplo, de base de datos) podría citar un valor personal en su mensaje. Mitigación vigente: el cuerpo público nunca lo lleva. Se revisará en la 0.10 y con Prisma (0.11): traducir los errores de infraestructura a mensajes sin valores antes de que lleguen al filtro.
- **`DomainError` depende hoy de `@repo/contracts`** (usa `ERROR_CODE_PATTERN`). En la 0.12, al pasar a `@repo/domain`, esa dependencia no está permitida: según `docs/architecture-rules.md`, `domain` no importa ningún paquete interno y `contracts` no importa `domain`. En ese momento el patrón se define en `@repo/domain` y se duplica en `@repo/contracts`, con una prueba en `apps/api` (que sí ve ambos) que asegure que los dos coinciden.
- `DOMAIN_ERROR_STATUS` todavía no impide que un `DomainError` use un código reservado del mapeo HTTP (por ejemplo `NOT_FOUND`). Se revisa cuando existan los primeros errores de dominio (Fase 1).

## Verificación

```bash
pnpm turbo run lint typecheck test --filter=@repo/api --filter=@repo/contracts
pnpm turbo run test:int --filter=@repo/api
pnpm lint:boundaries
```
