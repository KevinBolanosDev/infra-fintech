import { describe, expect, it } from 'vitest';

import { ManualClock } from './manual-clock.js';

const START = '2026-03-01T05:00:00.000Z';

describe('ManualClock', () => {
  it('devuelve el instante inicial, cada vez en un Date nuevo', async () => {
    const clock = new ManualClock(START);
    const first = await clock.now();
    expect(first.toISOString()).toBe(START);
    first.setUTCFullYear(1999);
    expect((await clock.now()).toISOString()).toBe(START);
  });

  it('acepta un Date como inicio y no lo comparte', async () => {
    const start = new Date(START);
    const clock = new ManualClock(start);
    start.setUTCFullYear(1999);
    expect((await clock.now()).toISOString()).toBe(START);
  });

  it('set fija el instante y advance lo mueve en milisegundos', async () => {
    const clock = new ManualClock(START);
    clock.advance(86_400_000);
    expect((await clock.now()).toISOString()).toBe('2026-03-02T05:00:00.000Z');
    clock.advance(-1);
    expect((await clock.now()).toISOString()).toBe('2026-03-02T04:59:59.999Z');
    clock.set(new Date('2027-01-01T00:00:00.000Z'));
    expect((await clock.now()).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY])('rechaza advance(%s)', (ms) => {
    expect(() => {
      new ManualClock(START).advance(ms);
    }).toThrow('entero de milisegundos');
  });

  it('rechaza un instante inválido', () => {
    expect(() => new ManualClock('no-es-una-fecha')).toThrow('instante inválido');
    expect(() => {
      new ManualClock(START).set('tampoco');
    }).toThrow('instante inválido');
  });
});
