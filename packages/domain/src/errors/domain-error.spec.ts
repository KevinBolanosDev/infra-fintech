import { describe, expect, it } from 'vitest';

import { DomainError, ERROR_CODE_PATTERN } from './domain-error.js';

describe('DomainError', () => {
  it('guarda el código y el mensaje público', () => {
    const cause = new Error('raíz');
    const error = new DomainError('CHARGE_ALREADY_PAID', 'El cobro ya fue pagado.', { cause });
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: 'DomainError',
      code: 'CHARGE_ALREADY_PAID',
      message: 'El cobro ya fue pagado.',
    });
    expect(error.cause).toBe(cause);
  });

  it.each(['charge_already_paid', 'CHARGE-PAID', ''])('rechaza el código %s', (code) => {
    expect(() => new DomainError(code, 'mensaje')).toThrow('MAYÚSCULAS_CON_GUION_BAJO');
  });
});

describe('ERROR_CODE_PATTERN', () => {
  it.each(['NOT_FOUND', 'CHARGE_ALREADY_PAID', 'HTTP_418', 'A'])('acepta %s', (code) => {
    expect(ERROR_CODE_PATTERN.test(code)).toBe(true);
  });

  it.each(['not_found', '_X', 'X_', 'X__Y', '1X', 'X-Y'])('rechaza %s', (code) => {
    expect(ERROR_CODE_PATTERN.test(code)).toBe(false);
  });
});
