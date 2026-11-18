// @ts-check
import { globalIgnores } from 'eslint/config';

import { createBaseConfig } from './eslint/base.js';

export default [
  ...createBaseConfig({ tsconfigRootDir: import.meta.dirname }),
  // Mini-monorepo de prueba de las fronteras: no es código del paquete.
  globalIgnores(['eslint/__fixtures__/']),
];
