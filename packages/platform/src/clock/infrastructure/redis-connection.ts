import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

/** Token de la conexión propia del reloj controlable. */
export const CLOCK_REDIS = Symbol('CLOCK_REDIS');

/**
 * Conexión perezosa (no conecta hasta el primer comando) con tiempos límite: un Redis caído o colgado
 * hace fallar `now()` (falla cerrado), nunca lo deja esperando sin fin.
 */
export function createClockRedis(url: string): Redis {
  const redis = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    connectTimeout: 5_000,
    commandTimeout: 2_000,
  });
  // Los fallos ya llegan como rechazo de cada comando; sin este listener ioredis los escribiría por
  // consola ("Unhandled error event"), fuera del logger y con datos de conexión.
  redis.on('error', () => undefined);
  return redis;
}

/** Cierra la conexión del reloj al apagar la app (`app.close()` o señal con shutdown hooks). */
@Injectable()
export class ClockRedisCloser implements OnModuleDestroy {
  constructor(
    @Inject(CLOCK_REDIS) private readonly redis: Pick<Redis, 'status' | 'quit' | 'disconnect'>,
  ) {}

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status === 'ready') {
      try {
        await this.redis.quit();
        return;
      } catch {
        // La conexión cayó entre la comprobación y el QUIT: se corta igual, sin romper el cierre.
      }
    }
    // Nunca conectó (o está reconectando): cortar sin esperar respuesta.
    this.redis.disconnect();
  }
}
