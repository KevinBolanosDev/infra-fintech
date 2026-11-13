import {
  type CoverageProfile,
  createVitestConfig,
  type VitestConfigOptions,
} from '@repo/config/vitest/base';
import swc from 'unplugin-swc';
import type { Plugin, ViteUserConfig } from 'vitest/config';

/**
 * Opciones de SWC para NestJS 12 en ESM. Son explícitas (no se infieren del tsconfig) para que
 * el resultado no dependa de qué tsconfig encuentre el plugin: decoradores heredados con
 * metadatos (`emitDecoratorMetadata`), sin `define` en campos de clase y nombres de clase intactos.
 */
export const NEST_SWC_OPTIONS = {
  tsconfigFile: false,
  jsc: {
    target: 'es2024',
    parser: { syntax: 'typescript', decorators: true },
    transform: {
      legacyDecorator: true,
      decoratorMetadata: true,
      useDefineForClassFields: false,
    },
    keepClassNames: true,
  },
} as const;

export type NestVitestConfigOptions = Omit<VitestConfigOptions, 'profile'> & {
  /** Por defecto `nest` (85 % de líneas). */
  readonly profile?: CoverageProfile;
};

/** Apps y paquetes NestJS: transforma con SWC para que funcione la inyección por decoradores. */
export function createNestVitestConfig(options: NestVitestConfigOptions = {}): ViteUserConfig {
  const swcPlugin: Plugin = swc.vite(NEST_SWC_OPTIONS);

  return createVitestConfig({
    ...options,
    profile: options.profile ?? 'nest',
    plugins: [swcPlugin, ...(options.plugins ?? [])],
  });
}
