import { createNodeVitestConfig } from './vitest/node.js';

// @repo/config no tiene src/: sus archivos con lógica están en eslint/ y vitest/.
export default createNodeVitestConfig({
  include: ['eslint/**/*.spec.ts', 'vitest/**/*.spec.ts'],
  coverageInclude: ['eslint/**/*.js', 'vitest/**/*.ts'],
});
