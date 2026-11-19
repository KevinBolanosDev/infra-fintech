import type { ProblemDetailItem } from '@repo/contracts';

/** Entrada inválida según un esquema de `@repo/contracts`: se responde 400 `VALIDATION_FAILED`. */
export class RequestValidationError extends Error {
  override readonly name = 'RequestValidationError';

  constructor(readonly details: readonly ProblemDetailItem[]) {
    super('La petición tiene campos inválidos.');
  }
}
