import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ShutdownLogger } from './shutdown-logger.js';

describe('ShutdownLogger', () => {
  it('registra el cierre con la señal recibida', () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const shutdown = new ShutdownLogger();

    shutdown.onApplicationShutdown('SIGTERM');
    shutdown.onApplicationShutdown();

    expect(log).toHaveBeenNthCalledWith(1, 'api cerrada (SIGTERM)');
    expect(log).toHaveBeenNthCalledWith(2, 'api cerrada (sin señal)');
  });
});
