import { type DynamicModule, Module, type Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClockModule } from '@repo/platform';

import type { AppConfig } from './config/env.schema.js';
import { HealthModule } from './health/health.module.js';
import { ShutdownLogger } from './lifecycle/shutdown-logger.js';

/** Clave con la que la configuración validada queda en `ConfigService` (`config.get('app')`). */
export const APP_CONFIG_KEY = 'app';

@Module({})
export class AppModule {
  /**
   * La configuración llega ya validada (`parseEnv`): `ConfigModule` no lee archivos `.env` ni vuelve
   * a validar `process.env`, así que la app es determinista en pruebas.
   * `extraModules` es solo para pruebas (ver `CreateAppOptions`).
   */
  static register(config: AppConfig, extraModules: readonly Type[] = []): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ [APP_CONFIG_KEY]: config })],
        }),
        // Reloj de negocio global (ADR-0011): `ClockService` en cualquier módulo.
        ClockModule.forRoot({
          mode: config.CLOCK_MODE,
          appEnv: config.APP_ENV,
          redisUrl: config.REDIS_URL,
        }),
        HealthModule,
        ...extraModules,
      ],
      providers: [ShutdownLogger],
    };
  }
}
