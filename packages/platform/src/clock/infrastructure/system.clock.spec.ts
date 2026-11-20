import 'reflect-metadata';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ClockService } from '../application/clock.service.js';
import { SystemClock } from './system.clock.js';

describe('SystemClock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('devuelve la hora del sistema (simulada aquí con un instante fijo)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-05-10T15:30:00.000Z'));
    const clock = new SystemClock();
    expect(clock).toBeInstanceOf(ClockService);
    expect((await clock.now()).toISOString()).toBe('2026-05-10T15:30:00.000Z');
  });

  it('cada llamada devuelve un Date nuevo', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-05-10T15:30:00.000Z'));
    const clock = new SystemClock();
    const first = await clock.now();
    first.setUTCFullYear(1999);
    expect((await clock.now()).getUTCFullYear()).toBe(2026);
  });
});
