import { createNestVitestConfig } from '@repo/config/vitest/nest';

// Unitarias (src/**/*.spec.ts) y e2e en proceso con Supertest (test/e2e/**/*.e2e-spec.ts).
export default createNestVitestConfig({
  include: ['src/**/*.spec.ts', 'test/e2e/**/*.e2e-spec.ts'],
});
