import { describe, expect, it } from 'vitest';

import { COVERAGE_THRESHOLDS } from './base.js';
import { createNodeVitestConfig } from './node.js';

describe('createNodeVitestConfig', () => {
  it('usa el perfil utility (80 % de líneas) por defecto', () => {
    const config = createNodeVitestConfig();

    expect(config.test?.coverage).toMatchObject({ thresholds: COVERAGE_THRESHOLDS.utility });
    expect(config.test?.environment).toBe('node');
  });

  it('respeta el perfil y las opciones que recibe', () => {
    const config = createNodeVitestConfig({ profile: 'domain', kind: 'integration' });

    expect(config.test?.passWithNoTests).toBe(true);
    expect(config.test?.coverage).toMatchObject({ thresholds: COVERAGE_THRESHOLDS.domain });
  });
});
