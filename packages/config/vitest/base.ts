import { defineConfig, type Plugin, type ViteUserConfig } from 'vitest/config';

/**
 * Perfiles de cobertura de la "Política de pruebas por módulo, archivo y componente" del plan:
 * - `domain`: entidades, valores y reglas puras (`packages/domain`): 90 % de ramas.
 * - `nest`: casos de uso y módulos NestJS: 85 % de líneas.
 * - `utility`: utilidades y paquetes técnicos: 80 % de líneas.
 */
export type CoverageProfile = 'domain' | 'nest' | 'utility';

/** Unitarias junto al archivo (`*.spec.ts`) o integración (`test/integration/*.int-spec.ts`). */
export type TestKind = 'unit' | 'integration';

export interface CoverageThresholds {
  readonly lines?: number;
  readonly branches?: number;
  readonly functions?: number;
  readonly statements?: number;
}

export const COVERAGE_THRESHOLDS: Readonly<Record<CoverageProfile, CoverageThresholds>> = {
  domain: { branches: 90 },
  nest: { lines: 85 },
  utility: { lines: 80 },
};

export const UNIT_TEST_INCLUDE = ['src/**/*.spec.ts'] as const;
export const INTEGRATION_TEST_INCLUDE = ['test/integration/**/*.int-spec.ts'] as const;

/** Archivos que nunca cuentan para la cobertura: pruebas, tipos y código generado. */
export const COVERAGE_EXCLUDE = [
  '**/*.spec.ts',
  '**/*.int-spec.ts',
  '**/*.e2e-spec.ts',
  '**/*.d.ts',
  '**/generated/**',
  '**/node_modules/**',
  '**/dist/**',
] as const;

export interface VitestConfigOptions {
  /** Perfil de umbrales de cobertura. */
  readonly profile: CoverageProfile;
  /** Tipo de suite. Por defecto `unit`. */
  readonly kind?: TestKind;
  /** Archivos de prueba; por defecto según `kind`. */
  readonly include?: readonly string[];
  /** Archivos medidos por la cobertura (solo `unit`). Por defecto `src/**\/*.ts`. */
  readonly coverageInclude?: readonly string[];
  /**
   * Umbrales adicionales o más exigentes que los del perfil (por ejemplo, ramas en
   * `observability`). Se combinan con el perfil; nunca pueden bajar su mínimo.
   */
  readonly thresholds?: CoverageThresholds;
  /** Plugins de Vite (el perfil Nest añade SWC). */
  readonly plugins?: readonly Plugin[];
}

const COVERAGE_METRICS = ['lines', 'branches', 'functions', 'statements'] as const;

/**
 * Combina los umbrales del perfil con los del paquete. Un paquete puede añadir métricas o
 * endurecerlas, pero no bajar el mínimo del perfil: la política de pruebas del plan es un piso.
 */
export function resolveCoverageThresholds(
  profile: CoverageProfile,
  overrides: CoverageThresholds = {},
): CoverageThresholds {
  const floor = COVERAGE_THRESHOLDS[profile];
  const resolved: Partial<Record<(typeof COVERAGE_METRICS)[number], number>> = {};

  for (const metric of COVERAGE_METRICS) {
    const minimum = floor[metric];
    const requested = overrides[metric];

    if (requested === undefined) {
      // Un `undefined` explícito nunca borra el mínimo del perfil.
      if (minimum !== undefined) {
        resolved[metric] = minimum;
      }
      continue;
    }
    if (!Number.isFinite(requested) || requested < 0 || requested > 100) {
      throw new Error(
        `El umbral de ${metric} debe ser un porcentaje entre 0 y 100 (recibido: ${String(requested)}).`,
      );
    }
    if (minimum !== undefined && requested < minimum) {
      throw new Error(
        `El umbral de ${metric} (${String(requested)} %) no puede ser menor que el mínimo del perfil "${profile}" (${String(minimum)} %).`,
      );
    }
    resolved[metric] = requested;
  }

  return resolved;
}

/**
 * Fábrica única de configuración de Vitest para el monorepo.
 *
 * - `unit`: cobertura v8 siempre activa; por debajo del umbral, `vitest run` termina con código 1.
 * - `integration`: sin cobertura, y no falla si aún no hay suites (`passWithNoTests`).
 */
export function createVitestConfig(options: VitestConfigOptions): ViteUserConfig {
  const kind = options.kind ?? 'unit';
  const isUnit = kind === 'unit';
  const include = options.include ?? (isUnit ? UNIT_TEST_INCLUDE : INTEGRATION_TEST_INCLUDE);

  return defineConfig({
    plugins: [...(options.plugins ?? [])],
    test: {
      include: [...include],
      environment: 'node',
      passWithNoTests: !isUnit,
      restoreMocks: true,
      coverage: {
        enabled: isUnit,
        provider: 'v8',
        include: [...(options.coverageInclude ?? ['src/**/*.ts'])],
        exclude: [...COVERAGE_EXCLUDE],
        reporter: ['text', 'json-summary'],
        thresholds: { ...resolveCoverageThresholds(options.profile, options.thresholds) },
      },
    },
  });
}
