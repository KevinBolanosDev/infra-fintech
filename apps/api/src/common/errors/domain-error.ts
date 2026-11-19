import { ERROR_CODE_PATTERN } from '@repo/contracts';

/**
 * Error de negocio con un código estable y un mensaje **pensado para el cliente**. No sabe nada de
 * HTTP: el filtro de errores traduce el código a estado (por defecto 422).
 *
 * Vive aquí provisionalmente (decisión Q-3 de la 0.9, ADR-0008); pasa a `@repo/domain` en la 0.12.
 */
export class DomainError extends Error {
  override readonly name: string = 'DomainError';

  constructor(
    /** MAYÚSCULAS_CON_GUION_BAJO, por ejemplo `CHARGE_ALREADY_PAID`. */
    readonly code: string,
    /** Mensaje público: llega tal cual al cliente en `detail`. Nunca datos personales ni internos. */
    publicMessage: string,
    options?: ErrorOptions,
  ) {
    super(publicMessage, options);
    if (!ERROR_CODE_PATTERN.test(code)) {
      throw new Error(
        `Código de error de dominio inválido (${code}): use MAYÚSCULAS_CON_GUION_BAJO`,
      );
    }
  }
}
