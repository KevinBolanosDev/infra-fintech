import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { POSTGRES_IMAGE, REDIS_IMAGE } from './images.js';

const COMPOSE = readFileSync(
  new URL('../../../../infra/docker/compose.yaml', import.meta.url),
  'utf8',
);

/** `image:` del servicio de Compose (primer `image:` después de `  <servicio>:`). */
function composeImage(service: string): string | undefined {
  const block = COMPOSE.split(`\n  ${service}:\n`)[1];
  return block?.match(/^\s+image:\s*(\S+)\s*$/m)?.[1];
}

describe('imágenes de prueba', () => {
  it.each([
    ['postgres', POSTGRES_IMAGE],
    ['redis', REDIS_IMAGE],
  ])('%s usa la misma imagen y digest que infra/docker/compose.yaml', (service, image) => {
    expect(composeImage(service)).toBe(image);
    expect(image).toMatch(/:[\w.-]+@sha256:[0-9a-f]{64}$/);
  });
});
