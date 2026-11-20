import 'reflect-metadata';

import { Test, type TestingModule } from '@nestjs/testing';
import { harnessUrls, resetRedis } from '@repo/testing';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  ClockService,
  ControllableClockService,
} from '../../src/clock/application/clock.service.js';
import { ClockModule } from '../../src/clock/clock.module.js';

/** Margen para el tiempo que corre entre dos lecturas (el reloj controlable no se congela). */
const TOLERANCE_MS = 2_000;

async function createInstance(redisUrl: string): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [ClockModule.forRoot({ mode: 'controllable', appEnv: 'test', redisUrl })],
  }).compile();
}

describe('Reloj controlable con Redis real (dos instancias de la app)', () => {
  const { redisUrl } = harnessUrls();
  const redis = new Redis(redisUrl);
  let instanceA: TestingModule;
  let instanceB: TestingModule;

  beforeAll(async () => {
    [instanceA, instanceB] = await Promise.all([
      createInstance(redisUrl),
      createInstance(redisUrl),
    ]);
  });

  beforeEach(async () => {
    await resetRedis(redis);
  });

  afterAll(async () => {
    await Promise.all([instanceA.close(), instanceB.close(), redis.quit()]);
  });

  it('lo que fija una instancia lo ve la otra (mismo instante dentro de la tolerancia)', async () => {
    const target = new Date('2027-06-30T23:59:00.000Z');
    await instanceA.get(ControllableClockService).set(target);

    const [seenByA, seenByB] = await Promise.all([
      instanceA.get(ClockService).now(),
      instanceB.get(ClockService).now(),
    ]);
    for (const seen of [seenByA, seenByB]) {
      expect(seen.getTime() - target.getTime()).toBeGreaterThanOrEqual(0);
      expect(seen.getTime() - target.getTime()).toBeLessThan(TOLERANCE_MS);
    }
    expect(Math.abs(seenByA.getTime() - seenByB.getTime())).toBeLessThan(TOLERANCE_MS);
  });

  it('advance desde una instancia mueve el reloj de las dos', async () => {
    const target = new Date('2027-01-01T00:00:00.000Z');
    await instanceB.get(ControllableClockService).set(target);
    await instanceB.get(ControllableClockService).advance(7 * 86_400_000);

    const seenByA = await instanceA.get(ClockService).now();
    const expected = Date.parse('2027-01-08T00:00:00.000Z');
    expect(seenByA.getTime() - expected).toBeGreaterThanOrEqual(0);
    expect(seenByA.getTime() - expected).toBeLessThan(TOLERANCE_MS);
  });
});
