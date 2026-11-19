import { describe, expect, it } from 'vitest';

import { DomainError } from './domain-error.js';

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
