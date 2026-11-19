# @repo/contracts

Contratos públicos de la API: esquemas Zod compartidos entre `apps/api`, la web y los adaptadores de proveedores. Solo depende de `zod` (lo verifica `pnpm lint:boundaries`). Se compila con `tsc` a `dist/` (ADR-0005).

## Errores (RFC 9457, ADR-0008)

`problemDetailsSchema` describe el cuerpo de todo error de la API (`Content-Type: application/problem+json`):

```json
{
  "type": "urn:problem-type:validation-failed",
  "title": "Datos inválidos",
  "status": 400,
  "detail": "La petición tiene campos inválidos.",
  "instance": "/v1/cobros",
  "code": "VALIDATION_FAILED",
  "details": [{ "field": "monto", "code": "too_small", "message": "Too small: expected number to be >0" }],
  "request_id": "0b5d8a5e-1f3c-4c8e-9a52-6f1f3d2b7c10"
}
```

- `code`: MAYÚSCULAS_CON_GUION_BAJO; `type` se deriva con `problemTypeFor(code)`.
- `details` siempre está presente (vacío si no aplica).
- `instance` es la ruta sin query string; `request_id` coincide con la cabecera `X-Request-Id`.

Cambiar este contrato es un cambio incompatible para los clientes.

```bash
pnpm turbo run lint typecheck test build --filter=@repo/contracts
```
