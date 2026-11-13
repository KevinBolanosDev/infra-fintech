import {
  type CoverageProfile,
  createVitestConfig,
  type VitestConfigOptions,
} from '@repo/config/vitest/base';
import type { ViteUserConfig } from 'vitest/config';

export type NodeVitestConfigOptions = Omit<VitestConfigOptions, 'profile'> & {
  /** Por defecto `utility` (80 % de líneas). */
  readonly profile?: CoverageProfile;
};

/** Paquetes de Node.js sin decoradores (`observability`, `testing`, utilidades). */
export function createNodeVitestConfig(options: NodeVitestConfigOptions = {}): ViteUserConfig {
  return createVitestConfig({ ...options, profile: options.profile ?? 'utility' });
}
