import { randomUUID } from 'node:crypto';

import { type ExecutionContext, executionContext } from '@repo/observability';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'X-Request-Id';
export const CORRELATION_ID_HEADER = 'X-Correlation-Id';

/** Un UUID (cualquier versión). Un identificador que llega de fuera solo se acepta con esta forma. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validIdOrUndefined(value: string | undefined): string | undefined {
  return value !== undefined && UUID_PATTERN.test(value) ? value.toLowerCase() : undefined;
}

/**
 * Da a cada petición su `request_id` (el `X-Request-Id` recibido si es un UUID válido; si no, uno
 * nuevo), su `correlation_id` (`X-Correlation-Id` válido o el mismo `request_id`), y ejecuta el resto
 * de la petición dentro del contexto de ejecución de `@repo/observability`, con la IP y el agente de
 * usuario. Devuelve `X-Request-Id` en la respuesta.
 */
export function createRequestContextMiddleware(context: ExecutionContext = executionContext) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const requestId = validIdOrUndefined(request.get(REQUEST_ID_HEADER)) ?? randomUUID();
    const correlationId = validIdOrUndefined(request.get(CORRELATION_ID_HEADER)) ?? requestId;
    const userAgent = request.get('user-agent');
    response.setHeader(REQUEST_ID_HEADER, requestId);

    context.run(
      {
        requestId,
        correlationId,
        ...(request.ip === undefined ? {} : { ip: request.ip }),
        ...(userAgent === undefined ? {} : { userAgent }),
      },
      next,
    );
  };
}
