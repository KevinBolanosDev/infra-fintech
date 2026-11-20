import type { Clock } from '@repo/domain';

import { ControllableClockService } from '../application/clock.service.js';

/** Clave de Redis con el desfase (ms) entre la hora de negocio y la del sistema. Sin clave: 0. */
export const CLOCK_OFFSET_KEY = 'fintech:clock:offset_ms';

/** Lo mínimo de `ioredis` que usa el reloj (facilita las pruebas). */
export interface OffsetStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  incrby(key: string, increment: number): Promise<number>;
}

/** Límite de un `Date` de JavaScript (±100 000 000 días desde 1970), en milisegundos. */
const MAX_DATE_MS = 8_640_000_000_000_000;
const INTEGER_PATTERN = /^-?\d+$/;

function assertWholeMs(ms: number, operation: string): void {
  if (!Number.isSafeInteger(ms) || Math.abs(ms) > MAX_DATE_MS) {
    throw new Error(`Reloj controlable: ${operation} espera un entero de milisegundos en rango`);
  }
}

/**
 * Reloj controlable respaldado en Redis (D-13 = A, Q-3 = a de la 0.12): guarda un **desfase** y
 * devuelve `hora del sistema + desfase`, así que el tiempo sigue corriendo y todas las instancias
 * (api, worker) ven el mismo instante. `set` es un `SET` y `advance` un `INCRBY`: ambos atómicos.
 * No lee la hora del sistema: se la pide a un `Clock` inyectado (`SystemClock`).
 */
export class RedisControllableClock extends ControllableClockService {
  constructor(
    private readonly store: OffsetStore,
    private readonly system: Clock,
  ) {
    super();
  }

  async now(): Promise<Date> {
    const [system, offset] = await Promise.all([this.system.now(), this.offsetMs()]);
    const now = new Date(system.getTime() + offset);
    if (Number.isNaN(now.getTime())) {
      // Nunca un `Invalid Date` silencioso en vencimientos o asientos: se falla.
      throw new Error('Reloj controlable: el desfase lleva la hora fuera del rango de fechas');
    }
    return now;
  }

  async set(instant: Date): Promise<void> {
    const target = instant.getTime();
    assertWholeMs(target, 'set');
    const system = await this.system.now();
    await this.store.set(CLOCK_OFFSET_KEY, String(target - system.getTime()));
  }

  async advance(ms: number): Promise<void> {
    assertWholeMs(ms, 'advance');
    await this.store.incrby(CLOCK_OFFSET_KEY, ms);
  }

  /** Desfase actual en milisegundos (0 si nunca se movió). */
  async offsetMs(): Promise<number> {
    const raw = await this.store.get(CLOCK_OFFSET_KEY);
    if (raw === null) {
      return 0;
    }
    const offset = INTEGER_PATTERN.test(raw) ? Number(raw) : Number.NaN;
    if (!Number.isSafeInteger(offset)) {
      throw new Error(`Reloj controlable: valor inválido en ${CLOCK_OFFSET_KEY}`);
    }
    return offset;
  }
}
