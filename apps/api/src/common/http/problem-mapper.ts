import { randomUUID } from 'node:crypto';

import { HttpException } from '@nestjs/common';
import { type ProblemDetailItem, type ProblemDetails, problemTypeFor } from '@repo/contracts';

import { DomainError } from '../errors/domain-error.js';
import { RequestValidationError } from '../validation/request-validation.error.js';

/** Estado HTTP de cada error de dominio; sin entrada, 422. Se completa al crear los módulos. */
export const DOMAIN_ERROR_STATUS: Readonly<Record<string, number>> = {};
export const DEFAULT_DOMAIN_ERROR_STATUS = 422;

/** Código estable de los errores que no son de dominio, por estado HTTP. */
const CODE_BY_STATUS: Readonly<Record<number, string>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

/** Título y detalle fijos por código. El mensaje de una excepción nunca llega al cliente. */
const TEXTS: Readonly<Record<string, { title: string; detail: string }>> = {
  BAD_REQUEST: { title: 'Petición inválida', detail: 'La petición no se puede procesar.' },
  UNAUTHORIZED: { title: 'No autenticado', detail: 'Se requiere autenticación.' },
  FORBIDDEN: { title: 'Acceso denegado', detail: 'No tiene permiso para esta operación.' },
  NOT_FOUND: { title: 'No encontrado', detail: 'El recurso no existe.' },
  METHOD_NOT_ALLOWED: {
    title: 'Método no permitido',
    detail: 'El método no se admite en este recurso.',
  },
  CONFLICT: { title: 'Conflicto', detail: 'La operación entra en conflicto con el estado actual.' },
  PAYLOAD_TOO_LARGE: {
    title: 'Cuerpo demasiado grande',
    detail: 'El cuerpo de la petición supera el límite.',
  },
  UNSUPPORTED_MEDIA_TYPE: {
    title: 'Tipo de contenido no admitido',
    detail: 'El tipo de contenido no se admite.',
  },
  UNPROCESSABLE_ENTITY: {
    title: 'Operación no procesable',
    detail: 'La operación no se puede realizar.',
  },
  TOO_MANY_REQUESTS: { title: 'Demasiadas peticiones', detail: 'Intente de nuevo más tarde.' },
  SERVICE_UNAVAILABLE: { title: 'Servicio no disponible', detail: 'Intente de nuevo más tarde.' },
  INTERNAL_ERROR: {
    title: 'Error interno',
    detail: 'Ocurrió un error inesperado. Si persiste, informe el request_id.',
  },
  MALFORMED_BODY: {
    title: 'Cuerpo mal formado',
    detail: 'El cuerpo de la petición no es un JSON válido.',
  },
  VALIDATION_FAILED: { title: 'Datos inválidos', detail: 'La petición tiene campos inválidos.' },
  DOMAIN_RULE: { title: 'Operación no permitida', detail: 'La operación no se puede realizar.' },
};

export interface MappedProblem {
  readonly problem: ProblemDetails;
  /** 5xx: `error` con el error completo (enmascarado); 4xx: `info` sin pila. */
  readonly logLevel: 'error' | 'info';
}

interface Classified {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string;
  readonly details: readonly ProblemDetailItem[];
}

function textsFor(code: string, status: number): { title: string; detail: string } {
  return (
    TEXTS[code] ??
    (status >= 500 ? TEXTS['INTERNAL_ERROR'] : TEXTS['BAD_REQUEST']) ?? {
      title: 'Error',
      detail: 'Error.',
    }
  );
}

function byStatus(status: number): Classified {
  const code =
    CODE_BY_STATUS[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : `HTTP_${String(status)}`);
  return { status, code, ...textsFor(code, status), details: [] };
}

/** Errores de `body-parser`/`http-errors` (cuerpo mal formado o demasiado grande). */
function bodyParserError(error: unknown): { status: number; type?: string } | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const { status, type, expose } = error as { status?: unknown; type?: unknown; expose?: unknown };
  if (typeof status !== 'number' || typeof expose !== 'boolean' || status < 400 || status > 499) {
    return undefined;
  }
  return typeof type === 'string' ? { status, type } : { status };
}

function classify(error: unknown): Classified {
  if (error instanceof RequestValidationError) {
    return {
      status: 400,
      code: 'VALIDATION_FAILED',
      ...textsFor('VALIDATION_FAILED', 400),
      details: error.details,
    };
  }
  if (error instanceof DomainError) {
    const status = DOMAIN_ERROR_STATUS[error.code] ?? DEFAULT_DOMAIN_ERROR_STATUS;
    return {
      status,
      code: error.code,
      title: textsFor('DOMAIN_RULE', status).title,
      detail: error.message,
      details: [],
    };
  }
  if (error instanceof HttpException) {
    const status = error.getStatus();
    // Un estado que no es de error (por ejemplo 302) nunca sale como problem+json: se trata como 500.
    return byStatus(status >= 400 && status <= 599 ? status : 500);
  }
  const parserError = bodyParserError(error);
  if (parserError?.type === 'entity.parse.failed') {
    return { status: 400, code: 'MALFORMED_BODY', ...textsFor('MALFORMED_BODY', 400), details: [] };
  }
  if (parserError !== undefined) {
    return byStatus(parserError.status);
  }
  return byStatus(500);
}

/** Ruta sin query string: la query puede llevar datos que no deben volver en el error. */
export function instanceOf(url: string | undefined): string {
  const path = (url ?? '/').split('?')[0] ?? '/';
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Traduce cualquier error al cuerpo público RFC 9457 (D-11, ADR-0008). Nunca copia mensajes,
 * pilas ni nombres internos, salvo el mensaje público de un `DomainError`.
 */
export function mapToProblem(
  error: unknown,
  url: string | undefined,
  requestId: string | undefined,
): MappedProblem {
  const { status, code, title, detail, details } = classify(error);
  return {
    problem: {
      type: problemTypeFor(code),
      title,
      status,
      detail,
      instance: instanceOf(url),
      code,
      details: [...details],
      request_id: requestId ?? randomUUID(),
    },
    logLevel: status >= 500 ? 'error' : 'info',
  };
}
