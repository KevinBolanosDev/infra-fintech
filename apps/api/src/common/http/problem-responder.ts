import { PROBLEM_JSON_CONTENT_TYPE } from '@repo/contracts';
import { executionContext, type Logger } from '@repo/observability';
import type { Request, Response } from 'express';

import { mapToProblem } from './problem-mapper.js';
import { REQUEST_ID_HEADER } from './request-context.middleware.js';

/**
 * Responde cualquier error como `application/problem+json` y lo registra con su `request_id`
 * (que el logger toma del contexto de la petición). Lo usan el filtro global de Nest y el manejador
 * de errores de Express (errores de `body-parser`, que ocurren antes del enrutado de Nest).
 */
export class ProblemResponder {
  constructor(private readonly logger: Logger) {}

  respond(error: unknown, request: Request, response: Response): void {
    // Del contexto; si faltara, la cabecera que ya puso el middleware (nunca un id distinto).
    const header = response.getHeader(REQUEST_ID_HEADER);
    const requestId =
      executionContext.get()?.requestId ?? (typeof header === 'string' ? header : undefined);
    const { problem, logLevel } = mapToProblem(error, request.originalUrl, requestId);

    if (logLevel === 'error') {
      this.logger.error(
        { err: error, status: problem.status, code: problem.code },
        'error no controlado',
      );
    } else {
      this.logger.info({ status: problem.status, code: problem.code }, 'petición rechazada');
    }

    if (response.headersSent) {
      return;
    }
    response.status(problem.status).type(PROBLEM_JSON_CONTENT_TYPE).send(JSON.stringify(problem));
  }

  /** Manejador de errores de Express (cuatro parámetros). */
  readonly expressErrorHandler = (
    error: unknown,
    request: Request,
    response: Response,
    next: (error?: unknown) => void,
  ): void => {
    if (response.headersSent) {
      next(error);
      return;
    }
    this.respond(error, request, response);
  };
}
