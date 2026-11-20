import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';

import { REDIS_IMAGE } from './images.js';

export interface StartedRedis {
  readonly container: StartedRedisContainer;
  readonly url: string;
}

/** Arranca un Redis desechable con `noeviction`, como Compose (BullMQ no tolera expulsiones). */
export async function startRedis(): Promise<StartedRedis> {
  const container = await new RedisContainer(REDIS_IMAGE)
    .withCommand(['redis-server', '--maxmemory-policy', 'noeviction'])
    .start();
  return { container, url: container.getConnectionUrl() };
}
