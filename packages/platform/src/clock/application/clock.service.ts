import type { Clock } from '@repo/domain';

/**
 * `ClockService`: el reloj de negocio como token de inyección de NestJS (ADR-0011). Implementa el
 * puerto `Clock` de `@repo/domain`. Los casos de uso lo reciben por constructor (importado como
 * valor) y nunca leen la hora del sistema.
 */
export abstract class ClockService implements Clock {
  abstract now(): Promise<Date>;
}

/**
 * Reloj que se puede mover (solo `CLOCK_MODE=controllable`, nunca en producción). Lo usarán el panel
 * de simulación y los escenarios (Fase 2).
 */
export abstract class ControllableClockService extends ClockService {
  /** Fija el instante de negocio; a partir de ahí el tiempo sigue corriendo. */
  abstract set(instant: Date): Promise<void>;
  /** Mueve el instante de negocio un número entero de milisegundos (negativo para retroceder). */
  abstract advance(ms: number): Promise<void>;
}
