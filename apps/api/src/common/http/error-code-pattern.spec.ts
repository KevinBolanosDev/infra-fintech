import { ERROR_CODE_PATTERN as CONTRACTS_PATTERN } from '@repo/contracts';
import { ERROR_CODE_PATTERN as DOMAIN_PATTERN } from '@repo/domain';
import { describe, expect, it } from 'vitest';

// `@repo/domain` y `@repo/contracts` no pueden importarse entre sí, así que cada uno tiene su copia
// del formato de los códigos de error (ADR-0011). La api ve los dos: aquí se exige que coincidan.
describe('formato de los códigos de error', () => {
  it('es el mismo en @repo/domain y en @repo/contracts', () => {
    expect(DOMAIN_PATTERN.source).toBe(CONTRACTS_PATTERN.source);
    expect(DOMAIN_PATTERN.flags).toBe(CONTRACTS_PATTERN.flags);
  });
});
