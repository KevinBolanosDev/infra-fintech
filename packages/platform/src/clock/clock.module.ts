import { type DynamicModule, Module } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { ClockService, ControllableClockService } from './application/clock.service.js';
import { assertClockModeAllowed, type ClockModeConfig } from './application/clock-mode.js';
import {
  CLOCK_REDIS,
  ClockRedisCloser,
  createClockRedis,
} from './infrastructure/redis-connection.js';
import { RedisControllableClock } from './infrastructure/redis-controllable.clock.js';
import { SystemClock } from './infrastructure/system.clock.js';

export type ClockModuleOptions = ClockModeConfig;

/**
 * Reloj de negocio (ADR-0011). `forRoot` elige la implementación por `CLOCK_MODE` y es global:
 * cualquier módulo inyecta `ClockService`. Con `controllable` exporta también
 * `ControllableClockService`. Falla al arrancar si el modo no se permite (segunda defensa, después
 * del esquema de entorno de cada app).
 */
@Module({})
export class ClockModule {
  static forRoot(options: ClockModuleOptions): DynamicModule {
    assertClockModeAllowed(options);

    switch (options.mode) {
      case 'system':
        return {
          module: ClockModule,
          global: true,
          providers: [SystemClock, { provide: ClockService, useExisting: SystemClock }],
          exports: [ClockService],
        };
      case 'controllable':
        return ClockModule.controllable(options.redisUrl ?? '');
      default:
        // Inalcanzable tras la aserción; si cambia, lo desconocido nunca llega al reloj controlable.
        throw new Error('CLOCK_MODE desconocido');
    }
  }

  private static controllable(redisUrl: string): DynamicModule {
    return {
      module: ClockModule,
      global: true,
      providers: [
        SystemClock,
        { provide: CLOCK_REDIS, useFactory: () => createClockRedis(redisUrl) },
        ClockRedisCloser,
        {
          provide: RedisControllableClock,
          useFactory: (redis: Redis, system: SystemClock) =>
            new RedisControllableClock(redis, system),
          inject: [CLOCK_REDIS, SystemClock],
        },
        { provide: ClockService, useExisting: RedisControllableClock },
        { provide: ControllableClockService, useExisting: RedisControllableClock },
      ],
      exports: [ClockService, ControllableClockService],
    };
  }
}
