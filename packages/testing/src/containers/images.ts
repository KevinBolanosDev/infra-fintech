/**
 * Imágenes de los contenedores de prueba: las mismas, con el mismo digest, que
 * `infra/docker/compose.yaml` (Q-2, sub-fase 0.11; D-09). `images.spec.ts` falla si se separan.
 */
export const POSTGRES_IMAGE =
  'postgres:17.12-bookworm@sha256:40865bc877a289da75963d97d72b59633f639fc5af7a4e856bfa3714cae5b536';

export const REDIS_IMAGE =
  'redis:8.8.4-alpine@sha256:1273af45b299d2b8b60d0e400d90aa6c2c5b1794f01d6a7ca60ff3ba6e65efb5';
