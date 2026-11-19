import { describe, expect, it } from 'vitest';

import { type ProblemDetails, problemDetailsSchema, problemTypeFor } from './problem-details.js';

const valid: ProblemDetails = {
  type: 'urn:problem-type:validation-failed',
  title: 'Datos inválidos',
  status: 400,
  detail: 'La petición tiene campos inválidos.',
  instance: '/v1/cobros',
  code: 'VALIDATION_FAILED',
  details: [{ field: 'monto', code: 'too_small', message: 'Debe ser mayor que 0' }],
  request_id: '0b5d8a5e-1f3c-4c8e-9a52-6f1f3d2b7c10',
};

describe('problemDetailsSchema', () => {
  it('acepta el cuerpo de error de D-11', () => {
    expect(problemDetailsSchema.parse(valid)).toEqual(valid);
    expect(problemDetailsSchema.parse({ ...valid, details: [] }).details).toEqual([]);
  });

  it.each([
    ['type sin el prefijo urn', { type: 'about:blank' }],
    ['status fuera de 4xx/5xx', { status: 302 }],
    ['code en minúsculas', { code: 'not_found' }],
    ['instance que no es una ruta', { instance: 'v1/cobros' }],
    ['detail vacío', { detail: '' }],
    ['details ausente', { details: undefined }],
    ['request_id vacío', { request_id: '' }],
  ])('rechaza %s', (_, override) => {
    expect(problemDetailsSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});

describe('problemTypeFor', () => {
  it.each([
    ['NOT_FOUND', 'urn:problem-type:not-found'],
    ['VALIDATION_FAILED', 'urn:problem-type:validation-failed'],
    ['CHARGE_ALREADY_PAID', 'urn:problem-type:charge-already-paid'],
    ['INTERNAL_ERROR', 'urn:problem-type:internal-error'],
  ])('%s → %s', (code, expected) => {
    expect(problemTypeFor(code)).toBe(expected);
  });

  it.each(['not_found', 'NOT-FOUND', '_NOT_FOUND', ''])('rechaza el código %s', (code) => {
    expect(() => problemTypeFor(code)).toThrow('MAYÚSCULAS_CON_GUION_BAJO');
  });
});
