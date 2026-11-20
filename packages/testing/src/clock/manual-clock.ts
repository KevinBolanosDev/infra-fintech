import type { Clock } from '@repo/domain';

/**
 * Reloj manual para pruebas (ADR-0011): el tiempo solo se mueve con `set` y `advance`, así que las
 * pruebas son deterministas. Implementa el mismo puerto `Clock` que `SystemClock` y el reloj
 * controlable, y se inyecta en su lugar.
 */
export class ManualClock implements Clock {
  private epochMs: number;

  /** Instante inicial explícito: las pruebas nunca parten de la hora real. */
  constructor(start: Date | string) {
    this.epochMs = ManualClock.toEpochMs(start);
  }

  now(): Promise<Date> {
    return Promise.resolve(new Date(this.epochMs));
  }

  /** Fija el instante. */
  set(instant: Date | string): void {
    this.epochMs = ManualClock.toEpochMs(instant);
  }

  /** Avanza (o retrocede, con un valor negativo) un número entero de milisegundos. */
  advance(ms: number): void {
    if (!Number.isSafeInteger(ms)) {
      throw new Error(`ManualClock.advance: se esperaba un entero de milisegundos (${String(ms)})`);
    }
    this.epochMs += ms;
  }

  private static toEpochMs(instant: Date | string): number {
    const epochMs = new Date(instant).getTime();
    if (Number.isNaN(epochMs)) {
      throw new Error('ManualClock: instante inválido');
    }
    return epochMs;
  }
}
