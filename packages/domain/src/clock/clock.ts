/**
 * Puerto del reloj de negocio (ADR-0011). La única fuente de "ahora" del backend: nadie lee la hora
 * del sistema directamente (regla 6 de `CLAUDE.md`).
 *
 * Es **asíncrono** (cambia el contrato `now(): Date` del plan): el reloj controlable vive en Redis y
 * todas las instancias deben ver el mismo instante. Solo la capa `application` lo llama; las funciones
 * de dominio son puras y reciben la fecha como argumento.
 */
export interface Clock {
  /** Instante actual de negocio (UTC). Cada llamada devuelve un `Date` nuevo. */
  now(): Promise<Date>;
}
