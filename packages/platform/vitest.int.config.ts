import { createNestVitestConfig } from '@repo/config/vitest/nest';

// Integración con Redis real del harness (@repo/testing, ADR-0010).
export default createNestVitestConfig({
  kind: 'integration',
  globalSetup: ['@repo/testing/global-setup'],
});
