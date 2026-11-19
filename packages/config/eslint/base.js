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
 * Lecturas de la hora del sistema prohibidas (regla 6 de CLAUDE.md, ADR-0006): todo pasa por
 * `ClockService`. `new Date(valor)` sí se permite: construye una fecha, no lee el reloj.
 * Es una regla de buena fe (no atrapa, por ejemplo, `new Date(undefined)` ni `Reflect.get(Date, 'now')`).
 *
 * `no-restricted-syntax` es una sola regla: una configuración que defina sus propias restricciones
 * debe incluir estas (`['error', ...SYSTEM_TIME_RESTRICTIONS, ...propias]`) o las reemplazaría.
 */
export const SYSTEM_TIME_RESTRICTIONS = [
  {
    // Llamada o referencia: `Date.now()`, `Date['now']`, `const f = Date.now`, `setClock(Date.now)`.
    selector: "MemberExpression[object.name='Date'][property.name='now']",
    message: 'Date.now lee la hora del sistema: usa ClockService (regla 6 de CLAUDE.md, ADR-0006).',
  },
  {
    selector: "MemberExpression[object.property.name='Date'][property.name='now']",
    message:
      'globalThis.Date.now lee la hora del sistema: usa ClockService (regla 6 de CLAUDE.md, ADR-0006).',
  },
  {
    selector: "NewExpression[callee.property.name='Date'][arguments.length=0]",
    message:
      'new globalThis.Date() lee la hora del sistema: usa ClockService (regla 6 de CLAUDE.md, ADR-0006).',
  },
  {
    // Forma calculada: `Date['now']`.
    selector: "MemberExpression[object.name='Date'][property.value='now']",
    message:
      "Date['now'] lee la hora del sistema: usa ClockService (regla 6 de CLAUDE.md, ADR-0006).",
  },
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message:
      'new Date() sin argumentos lee la hora del sistema: usa ClockService (regla 6 de CLAUDE.md, ADR-0006).',
  },
  {
    selector: "CallExpression[callee.name='Date']",
    message:
      'Date() devuelve la hora del sistema: usa ClockService (regla 6 de CLAUDE.md, ADR-0006).',
  },
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
 * - Sin lecturas de la hora del sistema (`Date.now()`, `new Date()`, `Date()`), también en pruebas y
 *   archivos de configuración: las pruebas usan fechas explícitas o un reloj inyectado.
 *
 * @param {{ tsconfigRootDir: string, allowSystemTime?: boolean }} options
 *   `tsconfigRootDir`: directorio del paquete que consume la configuración.
 *   `allowSystemTime`: solo `packages/observability` (la hora del log es operativa, ADR-0006).
 */
export function createBaseConfig({ tsconfigRootDir, allowSystemTime = false }) {
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
        'no-restricted-syntax': allowSystemTime ? 'off' : ['error', ...SYSTEM_TIME_RESTRICTIONS],
        // Los módulos de NestJS son clases vacías con decorador (`@Module({...})`): es el patrón del framework.
        '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      },
    },
    {
      files: ['**/*.{js,mjs,cjs}'],
      extends: [tseslint.configs.disableTypeChecked],
    },
  );
}
