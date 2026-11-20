import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { problemDetailsSchema } from '@repo/contracts';
import { DomainError } from '@repo/domain';
import { describe, expect, it } from 'vitest';

import { RequestValidationError } from '../validation/request-validation.error.js';
import { instanceOf, mapToProblem } from './problem-mapper.js';

const REQUEST_ID = '0b5d8a5e-1f3c-4c8e-9a52-6f1f3d2b7c10';

function map(error: unknown, url = '/v1/cobros?documento=1000000000') {
  const mapped = mapToProblem(error, url, REQUEST_ID);
  // Todo resultado cumple el contrato público.
  expect(problemDetailsSchema.parse(mapped.problem)).toEqual(mapped.problem);
  return mapped;
}

describe('mapToProblem', () => {
  it('error inesperado → 500 genérico, sin mensaje, pila ni nombre internos', () => {
    const error = new TypeError('detalle interno sintético: tabla charges');
    const { problem, logLevel } = map(error);
    expect(problem).toMatchObject({
      type: 'urn:problem-type:internal-error',
      status: 500,
      code: 'INTERNAL_ERROR',
      title: 'Error interno',
      details: [],
      request_id: REQUEST_ID,
    });
    expect(JSON.stringify(problem)).not.toMatch(/detalle interno|TypeError|charges|at /);
    expect(logLevel).toBe('error');
  });

  it('instance es la ruta sin query string', () => {
    expect(map(new NotFoundException()).problem.instance).toBe('/v1/cobros');
    expect(instanceOf(undefined)).toBe('/');
    expect(instanceOf('sin-barra')).toBe('/sin-barra');
  });

  it.each([
    [new NotFoundException('Cannot GET /v1/x'), 404, 'NOT_FOUND'],
    [new BadRequestException('interno'), 400, 'BAD_REQUEST'],
    [new ConflictException('interno'), 409, 'CONFLICT'],
    [new HttpException('interno', 418), 418, 'HTTP_418'],
    [new HttpException('interno', 503), 503, 'SERVICE_UNAVAILABLE'],
    [new HttpException('interno', 507), 507, 'INTERNAL_ERROR'],
    [new HttpException('interno', 302), 500, 'INTERNAL_ERROR'],
  ])(
    'HttpException %# → %i %s con texto fijo (nunca el mensaje de la excepción)',
    (error, status, code) => {
      const { problem, logLevel } = map(error);
      expect(problem).toMatchObject({ status, code });
      expect(problem.detail).not.toMatch(/interno|Cannot GET/);
      expect(logLevel).toBe(status >= 500 ? 'error' : 'info');
    },
  );

  it('validación → 400 VALIDATION_FAILED con details por campo', () => {
    const details = [{ field: 'monto', code: 'too_small', message: 'Too small' }];
    const { problem, logLevel } = map(new RequestValidationError(details));
    expect(problem).toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      title: 'Datos inválidos',
      details,
    });
    expect(logLevel).toBe('info');
  });

  it('error de dominio → 422 por defecto con su código y su mensaje público', () => {
    const { problem } = map(new DomainError('CHARGE_ALREADY_PAID', 'El cobro ya fue pagado.'));
    expect(problem).toMatchObject({
      type: 'urn:problem-type:charge-already-paid',
      status: 422,
      code: 'CHARGE_ALREADY_PAID',
      title: 'Operación no permitida',
      detail: 'El cobro ya fue pagado.',
    });
  });

  it('errores de body-parser: JSON mal formado (400) y cuerpo demasiado grande (413)', () => {
    const parseFailed = Object.assign(new SyntaxError('Unexpected token interno'), {
      status: 400,
      type: 'entity.parse.failed',
      expose: true,
    });
    const tooLarge = Object.assign(new Error('request entity too large'), {
      status: 413,
      type: 'entity.too.large',
      expose: true,
    });
    const unsupported = Object.assign(new Error('unsupported charset'), {
      status: 415,
      expose: true,
    });

    expect(map(parseFailed).problem).toMatchObject({ status: 400, code: 'MALFORMED_BODY' });
    expect(map(tooLarge).problem).toMatchObject({ status: 413, code: 'PAYLOAD_TOO_LARGE' });
    expect(map(unsupported).problem).toMatchObject({ status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' });
  });

  it('un objeto con status pero sin forma de http-errors, o un valor no objeto, es un 500', () => {
    expect(map({ status: 400 }).problem.status).toBe(500);
    expect(map({ status: 503, expose: false }).problem.status).toBe(500);
    expect(map('texto').problem.status).toBe(500);
    expect(map(null).problem.status).toBe(500);
  });

  it('sin request_id del contexto genera uno', () => {
    const { problem } = mapToProblem(new NotFoundException(), '/x', undefined);
    expect(problem.request_id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
