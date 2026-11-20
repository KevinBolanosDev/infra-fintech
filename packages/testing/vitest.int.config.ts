import { createNodeVitestConfig } from '@repo/config/vitest/node';

// Suite de humo del harness: arranca Postgres y Redis desechables una vez por ejecución.
export default createNodeVitestConfig({
  kind: 'integration',
  globalSetup: ['@repo/testing/global-setup'],
});
