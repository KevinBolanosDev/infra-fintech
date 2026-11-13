import { describe, expect, it } from 'vitest';
import type { Plugin } from 'vitest/config';

import {
  COVERAGE_EXCLUDE,
  COVERAGE_THRESHOLDS,
  createVitestConfig,
  INTEGRATION_TEST_INCLUDE,
  resolveCoverageThresholds,
  UNIT_TEST_INCLUDE,
} from './base.js';

describe('createVitestConfig', () => {
  it.each([
    ['domain', { branches: 90 }],
    ['nest', { lines: 85 }],
    ['utility', { lines: 80 }],
  ] as const)('aplica los umbrales del perfil %s', (profile, expected) => {
    const config = createVitestConfig({ profile });

    expect(COVERAGE_THRESHOLDS[profile]).toEqual(expected);
    expect(config.test?.coverage).toMatchObject({ thresholds: expected });
  });

  it('configura las pruebas unitarias con cobertura v8 siempre activa', () => {
    const config = createVitestConfig({ profile: 'utility' });

    expect(config.test?.include).toEqual([...UNIT_TEST_INCLUDE]);
    expect(config.test?.passWithNoTests).toBe(false);
    expect(config.test?.environment).toBe('node');
    expect(config.test?.coverage).toMatchObject({
      enabled: true,
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [...COVERAGE_EXCLUDE],
    });
  });

  it('configura la integración sin cobertura y sin fallar cuando no hay suites', () => {
    const config = createVitestConfig({ profile: 'nest', kind: 'integration' });

    expect(config.test?.include).toEqual([...INTEGRATION_TEST_INCLUDE]);
    expect(config.test?.passWithNoTests).toBe(true);
    expect(config.test?.coverage).toMatchObject({ enabled: false });
  });

  it('permite reemplazar archivos de prueba y archivos medidos, y añadir umbrales al perfil', () => {
    const config = createVitestConfig({
      profile: 'utility',
      include: ['lib/**/*.spec.ts'],
      coverageInclude: ['lib/**/*.ts'],
      thresholds: { branches: 85 },
    });

    expect(config.test?.include).toEqual(['lib/**/*.spec.ts']);
    expect(config.test?.coverage).toMatchObject({
      include: ['lib/**/*.ts'],
      thresholds: { lines: 80, branches: 85 },
    });
  });

  it('no permite bajar el mínimo del perfil', () => {
    expect(() => createVitestConfig({ profile: 'domain', thresholds: { branches: 89 } })).toThrow(
      /no puede ser menor que el mínimo del perfil "domain" \(90 %\)/,
    );
  });

  it('excluye de la cobertura las pruebas, los tipos y el código generado', () => {
    expect(COVERAGE_EXCLUDE).toEqual(
      expect.arrayContaining(['**/*.spec.ts', '**/*.int-spec.ts', '**/*.d.ts', '**/generated/**']),
    );
  });

  it('un undefined explícito no borra el mínimo del perfil', () => {
    expect(resolveCoverageThresholds('domain', { branches: undefined, lines: 70 })).toEqual({
      branches: 90,
      lines: 70,
    });
  });

  it.each([Number.NaN, -1, 101, Number.POSITIVE_INFINITY])(
    'rechaza un umbral que no es un porcentaje válido (%s)',
    (value) => {
      expect(() => resolveCoverageThresholds('utility', { functions: value })).toThrow(
        /debe ser un porcentaje entre 0 y 100/,
      );
    },
  );

  it('combina los umbrales: el perfil es un piso que se puede endurecer o ampliar', () => {
    expect(resolveCoverageThresholds('nest')).toEqual({ lines: 85 });
    expect(resolveCoverageThresholds('nest', { lines: 90, functions: 80 })).toEqual({
      lines: 90,
      functions: 80,
    });
  });

  it('pasa los plugins de Vite que recibe', () => {
    const plugin: Plugin = { name: 'fake-plugin' };

    expect(createVitestConfig({ profile: 'utility', plugins: [plugin] }).plugins).toEqual([plugin]);
    expect(createVitestConfig({ profile: 'utility' }).plugins).toEqual([]);
  });
});
