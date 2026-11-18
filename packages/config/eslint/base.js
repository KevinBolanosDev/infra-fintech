// @ts-check
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

import { createBoundariesConfig } from './boundaries.js';

/** Rutas que nunca se lintean: dependencias, salida generada y migraciones. */
export const IGNORED_PATHS = [
  '**/node_modules/',
  '**/dist/',
  '**/coverage/',
  '**/.turbo/',
  '**/.next/',
  '**/generated/',
  '**/migrations/',
];

/**
 * Configuración base de ESLint (flat config) para todo el monorepo.
 *
 * - JavaScript recomendado + `typescript-eslint` estricto con información de tipos.
 * - Imports y exports ordenados (`simple-import-sort`, se corrige con `--fix`).
 * - Sin `any`: `no-explicit-any` y las reglas `no-unsafe-*` vienen en `strictTypeChecked`.
 * - Los archivos `.js` (configuraciones) se lintean sin información de tipos.
 * - Reglas de dependencia de `docs/architecture-rules.md` (`./boundaries.js`): un import
 *   prohibido es un error de lint, también en el hook que corre al escribir cada archivo.
 *
 * @param {{ tsconfigRootDir: string }} options Directorio del paquete que consume la configuración.
 */
export function createBaseConfig({ tsconfigRootDir }) {
  return defineConfig(
    globalIgnores(IGNORED_PATHS),
    createBoundariesConfig(),
    {
      files: ['**/*.{ts,tsx,mts,cts,js,mjs,cjs}'],
      extends: [js.configs.recommended, tseslint.configs.strictTypeChecked],
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      linterOptions: {
        reportUnusedDisableDirectives: 'error',
      },
      plugins: {
        'simple-import-sort': simpleImportSort,
      },
      rules: {
        'simple-import-sort/imports': 'error',
        'simple-import-sort/exports': 'error',
      },
    },
    {
      files: ['**/*.{js,mjs,cjs}'],
      extends: [tseslint.configs.disableTypeChecked],
    },
  );
}
