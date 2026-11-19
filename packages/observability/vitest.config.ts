import { createNodeVitestConfig } from '@repo/config/vitest/node';

// Perfil utility (80 % de líneas) más el 85 % de ramas que pide la sub-fase 0.7.
export default createNodeVitestConfig({ thresholds: { branches: 85 } });
