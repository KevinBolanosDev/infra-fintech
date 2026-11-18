import { createNodeVitestConfig } from './vitest/node.js';

// @repo/config no tiene src/: sus archivos con lógica están en eslint/ y vitest/ (sin subcarpetas;
// eslint/__fixtures__/ es un mini-monorepo de prueba, no se ejecuta ni se mide).
export default createNodeVitestConfig({
  include: ['eslint/*.spec.ts', 'vitest/*.spec.ts'],
  coverageInclude: ['eslint/*.js', 'vitest/*.ts'],
});
