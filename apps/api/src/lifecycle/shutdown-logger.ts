import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';

/** Deja constancia del cierre ordenado (`enableShutdownHooks`): sin él, esta línea no aparece. */
@Injectable()
export class ShutdownLogger implements OnApplicationShutdown {
  private readonly logger = new Logger('Shutdown');

  onApplicationShutdown(signal?: string): void {
    this.logger.log(`api cerrada (${signal ?? 'sin señal'})`);
  }
}
