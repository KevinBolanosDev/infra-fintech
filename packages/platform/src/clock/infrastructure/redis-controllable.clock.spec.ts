import { ManualClock } from '@repo/testing';
import { describe, expect, it } from 'vitest';

import { ControllableClockService } from '../application/clock.service.js';
import {
  CLOCK_OFFSET_KEY,
  type OffsetStore,
  RedisControllableClock,
} from './redis-controllable.clock.js';

/** Redis en memoria con la semántica de GET, SET e INCRBY. */
class MemoryStore implements OffsetStore {
  readonly values = new Map<string, string>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.values.get(key) ?? null);
  }

  set(key: string, value: string): Promise<'OK'> {
    this.values.set(key, value);
    return Promise.resolve('OK');
  }

  incrby(key: string, increment: number): Promise<number> {
    const next = Number(this.values.get(key) ?? '0') + increment;
    this.values.set(key, String(next));
    return Promise.resolve(next);
  }
}

const SYSTEM_START = '2026-01-15T12:00:00.000Z';

function setup() {
  const store = new MemoryStore();
  const system = new ManualClock(SYSTEM_START);
  return { store, system, clock: new RedisControllableClock(store, system) };
}

describe('RedisControllableClock', () => {
  it('sin desfase guardado devuelve la hora del sistema', async () => {
    const { clock } = setup();
    expect(clock).toBeInstanceOf(ControllableClockService);
    expect(await clock.offsetMs()).toBe(0);
    expect((await clock.now()).toISOString()).toBe(SYSTEM_START);
  });

  it('set guarda el desfase y el tiempo sigue corriendo a partir de ahí', async () => {
    const { clock, store, system } = setup();
    await clock.set(new Date('2026-12-31T23:00:00.000Z'));
    expect(store.values.get(CLOCK_OFFSET_KEY)).toBe(
      String(Date.parse('2026-12-31T23:00:00.000Z') - Date.parse(SYSTEM_START)),
    );
    expect((await clock.now()).toISOString()).toBe('2026-12-31T23:00:00.000Z');

    system.advance(90_000);
    expect((await clock.now()).toISOString()).toBe('2026-12-31T23:01:30.000Z');
  });

  it('advance suma milisegundos al desfase (también negativos)', async () => {
    const { clock } = setup();
    await clock.advance(86_400_000);
    expect((await clock.now()).toISOString()).toBe('2026-01-16T12:00:00.000Z');
    await clock.advance(-3_600_000);
    expect((await clock.now()).toISOString()).toBe('2026-01-16T11:00:00.000Z');
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY])('rechaza advance(%s)', async (ms) => {
    await expect(setup().clock.advance(ms)).rejects.toThrow('entero de milisegundos');
  });

  it('rechaza set con un instante inválido', async () => {
    await expect(setup().clock.set(new Date('no-es-fecha'))).rejects.toThrow(
      'entero de milisegundos',
    );
  });

  it.each(['no-es-numero', '', ' 5 ', '1e3', '0x10', '5.0', '99999999999999999999'])(
    'falla si la clave de Redis no tiene un entero canónico (%j)',
    async (raw) => {
      const { clock, store } = setup();
      store.values.set(CLOCK_OFFSET_KEY, raw);
      await expect(clock.now()).rejects.toThrow(`valor inválido en ${CLOCK_OFFSET_KEY}`);
    },
  );

  it('acepta desfases negativos guardados', async () => {
    const { clock, store } = setup();
    store.values.set(CLOCK_OFFSET_KEY, '-60000');
    expect((await clock.now()).toISOString()).toBe('2026-01-15T11:59:00.000Z');
  });

  it('nunca devuelve un Invalid Date: falla si el desfase saca la hora del rango', async () => {
    const { clock, store } = setup();
    store.values.set(CLOCK_OFFSET_KEY, '8640000000000000');
    await expect(clock.now()).rejects.toThrow('fuera del rango de fechas');
  });

  it('rechaza advance fuera del rango de un Date', async () => {
    await expect(setup().clock.advance(8_640_000_000_000_001)).rejects.toThrow('en rango');
  });

  it('la clave es la acordada (ADR-0011)', () => {
    expect(CLOCK_OFFSET_KEY).toBe('fintech:clock:offset_ms');
  });
});
