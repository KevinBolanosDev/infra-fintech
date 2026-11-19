import { ExecutionContext, type ExecutionContextStore } from '@repo/observability';
import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';

import { createRequestContextMiddleware } from './request-context.middleware.js';

const VALID = '0B5D8A5E-1F3C-4C8E-9A52-6F1F3D2B7C10';
const CORRELATION = '7a1f6a52-3c2b-4d8e-8f10-2b3c4d5e6f70';

function run(headers: Record<string, string>, ip?: string) {
  const context = new ExecutionContext();
  const responseHeaders: Record<string, string> = {};
  const request = { ip, get: (name: string) => headers[name.toLowerCase()] } as unknown as Request;
  const response = {
    setHeader: (name: string, value: string) => (responseHeaders[name] = value),
  } as unknown as Response;
  let seen: ExecutionContextStore | undefined;
  createRequestContextMiddleware(context)(request, response, () => {
    seen = context.get();
  });
  return { seen, responseHeaders };
}

describe('createRequestContextMiddleware', () => {
  it('acepta un X-Request-Id válido (normalizado) y lo devuelve en la respuesta', () => {
    const { seen, responseHeaders } = run(
      { 'x-request-id': VALID, 'user-agent': 'agente/1.0' },
      '10.0.0.1',
    );
    expect(seen).toEqual({
      requestId: VALID.toLowerCase(),
      correlationId: VALID.toLowerCase(),
      ip: '10.0.0.1',
      userAgent: 'agente/1.0',
    });
    expect(responseHeaders['X-Request-Id']).toBe(VALID.toLowerCase());
  });

  it.each(['no-es-un-uuid', `${VALID}x`, "'; DROP TABLE x; --", ''])(
    'reemplaza un X-Request-Id inválido (%s)',
    (header) => {
      const { seen, responseHeaders } = run({ 'x-request-id': header });
      expect(seen?.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(seen?.requestId).not.toBe(header);
      expect(responseHeaders['X-Request-Id']).toBe(seen?.requestId);
    },
  );

  it('usa X-Correlation-Id válido; si no, el mismo request_id', () => {
    expect(run({ 'x-correlation-id': CORRELATION }).seen?.correlationId).toBe(CORRELATION);
    const { seen } = run({ 'x-correlation-id': 'inválido' });
    expect(seen?.correlationId).toBe(seen?.requestId);
  });

  it('sin IP ni agente de usuario no añade esos campos', () => {
    const { seen } = run({});
    expect(seen).not.toHaveProperty('ip');
    expect(seen).not.toHaveProperty('userAgent');
  });
});
