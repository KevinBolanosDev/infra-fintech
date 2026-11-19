import { type ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

import { ProblemResponder } from './problem-responder.js';

/** Filtro global: todo error que llega a Nest sale como `application/problem+json` (D-11). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly responder: ProblemResponder) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    this.responder.respond(exception, http.getRequest<Request>(), http.getResponse<Response>());
  }
}
