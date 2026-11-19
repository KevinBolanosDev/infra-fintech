import { NotFoundException } from '@nestjs/common';
import { createLogger } from '@repo/observability';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { ProblemResponder } from './problem-responder.js';

function setup(headersSent: boolean) {
  const logger = createLogger({ service: 'api', level: 'silent', appEnv: 'test' });
  const responder = new ProblemResponder(logger);
  const send = vi.fn();
  const status = vi.fn().mockReturnThis();
  const type = vi.fn().mockReturnThis();
  const getHeader = () => '66666666-6666-4666-8666-666666666666';
  const response = { headersSent, status, type, send, getHeader } as unknown as Response;
  const request = { originalUrl: '/v1/x?y=1' } as unknown as Request;
  return { responder, response, request, send, status, type };
}

describe('ProblemResponder', () => {
  it('responde problem+json cuando aún no se enviaron cabeceras', () => {
    const { responder, response, request, send, status, type } = setup(false);
    responder.respond(new NotFoundException(), request, response);
    expect(status).toHaveBeenCalledWith(404);
    expect(type).toHaveBeenCalledWith('application/problem+json');
    expect(JSON.parse(String(send.mock.calls[0]?.[0]))).toMatchObject({
      code: 'NOT_FOUND',
      instance: '/v1/x',
    });
  });

  it('fuera del contexto usa el X-Request-Id que ya puso el middleware', () => {
    const { responder, response, request, send } = setup(false);
    responder.respond(new NotFoundException(), request, response);
    expect(JSON.parse(String(send.mock.calls[0]?.[0]))).toMatchObject({
      request_id: '66666666-6666-4666-8666-666666666666',
    });
  });

  it('si la respuesta ya empezó, no intenta escribir otra', () => {
    const { responder, response, request, send } = setup(true);
    responder.respond(new Error('tarde'), request, response);
    expect(send).not.toHaveBeenCalled();
  });

  it('el manejador de Express delega en Express si la respuesta ya empezó, y responde si no', () => {
    const started = setup(true);
    const next = vi.fn();
    started.responder.expressErrorHandler(new Error('x'), started.request, started.response, next);
    expect(next).toHaveBeenCalledOnce();

    const fresh = setup(false);
    const nextFresh = vi.fn();
    fresh.responder.expressErrorHandler(
      new NotFoundException(),
      fresh.request,
      fresh.response,
      nextFresh,
    );
    expect(nextFresh).not.toHaveBeenCalled();
    expect(fresh.send).toHaveBeenCalledOnce();
  });
});
