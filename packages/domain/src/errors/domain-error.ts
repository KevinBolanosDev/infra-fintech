/**
 * Formato de los códigos de error: MAYÚSCULAS_CON_GUION_BAJO. `@repo/contracts` tiene su propia copia
 * (ni `domain` ni `contracts` pueden importarse entre sí); `apps/api` prueba que coinciden (ADR-0011).
 */
export const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;

/**
 * Error de negocio con un código estable y un mensaje **pensado para el cliente**. No sabe nada de
 * HTTP: la api traduce el código a estado (por defecto 422, ADR-0008).
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
