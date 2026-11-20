import { describe, expect, it, vi } from 'vitest';

import { ClockRedisCloser, createClockRedis } from './redis-connection.js';

describe('createClockRedis', () => {
  it('crea una conexión perezosa con tiempos límite y sin errores sueltos', () => {
    const redis = createClockRedis('redis://127.0.0.1:1');
    expect(redis.status).toBe('wait');
    expect(redis.options).toMatchObject({ connectTimeout: 5_000, commandTimeout: 2_000 });
    expect(redis.listenerCount('error')).toBe(1);
    expect(() => redis.emit('error', new Error('sintético'))).not.toThrow();
    redis.disconnect();
  });
});

describe('ClockRedisCloser', () => {
  it('con la conexión lista, la cierra ordenadamente (QUIT)', async () => {
    const quit = vi.fn(() => Promise.resolve('OK' as const));
    const disconnect = vi.fn();
    await new ClockRedisCloser({ status: 'ready', quit, disconnect }).onModuleDestroy();
    expect(quit).toHaveBeenCalledOnce();
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('si QUIT falla, corta la conexión sin romper el cierre de la app', async () => {
    const quit = vi.fn(() => Promise.reject(new Error('conexión caída')));
    const disconnect = vi.fn();
    await expect(
      new ClockRedisCloser({ status: 'ready', quit, disconnect }).onModuleDestroy(),
    ).resolves.toBeUndefined();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it.each(['wait', 'reconnecting', 'end'] as const)(
    'sin conexión lista (%s), corta sin esperar respuesta',
    async (status) => {
      const quit = vi.fn(() => Promise.resolve('OK' as const));
      const disconnect = vi.fn();
      await new ClockRedisCloser({ status, quit, disconnect }).onModuleDestroy();
      expect(disconnect).toHaveBeenCalledOnce();
      expect(quit).not.toHaveBeenCalled();
    },
  );
});
