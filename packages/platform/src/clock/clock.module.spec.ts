import 'reflect-metadata';

import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { ClockService, ControllableClockService } from './application/clock.service.js';
import { ClockModule } from './clock.module.js';
import { RedisControllableClock } from './infrastructure/redis-controllable.clock.js';
import { SystemClock } from './infrastructure/system.clock.js';

describe('ClockModule.forRoot', { timeout: 20_000 }, () => {
  it('modo system: ClockService es SystemClock y no hay reloj controlable', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ClockModule.forRoot({ mode: 'system', appEnv: 'production' })],
    }).compile();

    expect(moduleRef.get(ClockService)).toBeInstanceOf(SystemClock);
    expect(() => moduleRef.get(ControllableClockService)).toThrow();
    await moduleRef.close();
  });

  it('modo controllable: ClockService y ControllableClockService son el reloj en Redis', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ClockModule.forRoot({
          mode: 'controllable',
          appEnv: 'test',
          redisUrl: 'redis://127.0.0.1:1',
        }),
      ],
    }).compile();

    const clock = moduleRef.get(ClockService);
    expect(clock).toBeInstanceOf(RedisControllableClock);
    expect(moduleRef.get(ControllableClockService)).toBe(clock);
    // Cierra la conexión perezosa sin haber conectado.
    await moduleRef.close();
  });

  it('falla al arrancar con controllable en producción', () => {
    expect(() =>
      ClockModule.forRoot({
        mode: 'controllable',
        appEnv: 'production',
        redisUrl: 'redis://127.0.0.1:1',
      }),
    ).toThrow('no se permite con APP_ENV=production');
  });

  it('falla al arrancar con controllable sin REDIS_URL', () => {
    expect(() => ClockModule.forRoot({ mode: 'controllable', appEnv: 'local' })).toThrow(
      'exige REDIS_URL',
    );
  });

  it.each([
    [{ mode: 'system', appEnv: 'test' }, SystemClock],
    [
      { mode: 'controllable', appEnv: 'test', redisUrl: 'redis://127.0.0.1:1' },
      RedisControllableClock,
    ],
  ] as const)(
    'es global: un módulo que no importa ClockModule recibe ClockService (%j)',
    async (options, expected) => {
      @Injectable()
      class Consumer {
        constructor(readonly clock: ClockService) {}
      }
      @Module({ providers: [Consumer] })
      class ConsumerModule {}

      const moduleRef = await Test.createTestingModule({
        imports: [ClockModule.forRoot(options), ConsumerModule],
      }).compile();
      expect(moduleRef.get(Consumer).clock).toBeInstanceOf(expected);
      await moduleRef.close();
    },
  );

  it.each(['Controllable', 'frozen'])('falla al arrancar con un modo desconocido (%s)', (mode) => {
    expect(() =>
      ClockModule.forRoot({
        mode: mode as 'controllable',
        appEnv: 'production',
        redisUrl: 'redis://127.0.0.1:1',
      }),
    ).toThrow('CLOCK_MODE desconocido');
  });
});
