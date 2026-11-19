import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AllExceptionsFilter } from './all-exceptions.filter.js';
import type { ProblemResponder } from './problem-responder.js';

describe('AllExceptionsFilter', () => {
  it('delega cualquier excepción en el ProblemResponder con la petición y la respuesta HTTP', () => {
    const respond = vi.fn();
    const request = { originalUrl: '/v1/x' };
    const response = {};
    const host = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as unknown as ArgumentsHost;
    const error = new Error('cualquiera');

    new AllExceptionsFilter({ respond } as unknown as ProblemResponder).catch(error, host);

    expect(respond).toHaveBeenCalledWith(error, request, response);
  });
});
