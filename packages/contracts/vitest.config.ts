import { createNodeVitestConfig } from '@repo/config/vitest/node';

// Contratos públicos: además del 80 % de líneas, todas las ramas.
export default createNodeVitestConfig({ thresholds: { branches: 100 } });
