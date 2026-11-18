// @ts-check
// Solo las reglas de dependencia (docs/architecture-rules.md) sobre todo el monorepo: `pnpm lint:boundaries`.
// Las mismas reglas también corren dentro de `pnpm lint` (base de cada paquete) y en el hook de edición.
import { IGNORED_PATHS } from '@repo/config/eslint/base';
import { createBoundariesConfig } from '@repo/config/eslint/boundaries';
import { globalIgnores } from 'eslint/config';

export default [
  globalIgnores([...IGNORED_PATHS, 'packages/config/eslint/__fixtures__/']),
  ...createBoundariesConfig(),
];
