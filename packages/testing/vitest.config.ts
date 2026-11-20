import { createNodeVitestConfig } from '@repo/config/vitest/node';

// Perfil utility (80 % de líneas) para las partes puras del harness (Q-9, sub-fase 0.11). El arranque
// de contenedores y el globalSetup se ejercitan en la suite de humo de integración.
export default createNodeVitestConfig({
  coverageExclude: [
    'src/containers/postgres.ts',
    'src/containers/redis.ts',
    'src/vitest/global-setup.ts',
  ],
});
