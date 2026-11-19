import { z } from 'zod';

/** `Content-Type` de toda respuesta de error de la API (RFC 9457). */
export const PROBLEM_JSON_CONTENT_TYPE = 'application/problem+json';

/** Prefijo de `type`: `urn:problem-type:<code-en-minúsculas-con-guiones>` (D-11, ADR-0008). */
export const PROBLEM_TYPE_PREFIX = 'urn:problem-type:';

/** Código estable para máquinas: MAYÚSCULAS_CON_GUION_BAJO. */
export const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;

/** Un problema concreto, por ejemplo un campo inválido. */
export const problemDetailItemSchema = z.object({
  /** Ruta del campo con puntos (`monto`, `inquilino.documento`, `items.0.valor`); vacío si es global. */
  field: z.string(),
  /** Código de la validación (`too_small`, `invalid_type`…). */
  code: z.string().min(1),
  message: z.string().min(1),
});

/**
 * Cuerpo de error de la API (RFC 9457) con las extensiones `code`, `details` y `request_id`.
 * Contrato público con la web y los proveedores: cambiarlo es un cambio incompatible.
 */
export const problemDetailsSchema = z.object({
  type: z.string().startsWith(PROBLEM_TYPE_PREFIX),
  title: z.string().min(1),
  status: z.number().int().min(400).max(599),
  detail: z.string().min(1),
  /** Ruta de la petición sin query string. */
  instance: z.string().startsWith('/'),
  code: z.string().regex(ERROR_CODE_PATTERN),
  /** Siempre presente; vacío si no aplica. */
  details: z.array(problemDetailItemSchema),
  request_id: z.string().min(1),
});

export type ProblemDetailItem = z.infer<typeof problemDetailItemSchema>;
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

/** `NOT_FOUND` → `urn:problem-type:not-found`. */
export function problemTypeFor(code: string): string {
  if (!ERROR_CODE_PATTERN.test(code)) {
    throw new Error(`Código de error inválido: debe ir en MAYÚSCULAS_CON_GUION_BAJO (${code})`);
  }
  return `${PROBLEM_TYPE_PREFIX}${code.toLowerCase().replaceAll('_', '-')}`;
}
