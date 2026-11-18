import { transform } from '@swc/core';
import { describe, expect, it } from 'vitest';
import type { Plugin } from 'vitest/config';

import { COVERAGE_THRESHOLDS } from './base.js';
import { createNestVitestConfig, NEST_SWC_OPTIONS } from './nest.js';

const DECORATED_SOURCE = `
declare function Injectable(): ClassDecorator;
class Clock {}
@Injectable()
export class ChargeService {
  constructor(private readonly clock: Clock) {}
}
`;

function pluginNames(plugins: unknown): string[] {
  return (plugins as Plugin[]).map((plugin) => plugin.name);
}

describe('createNestVitestConfig', () => {
  it('usa el perfil nest (85 % de líneas) y antepone el plugin de SWC', () => {
    const extra: Plugin = { name: 'extra' };
    const config = createNestVitestConfig({ plugins: [extra] });

    expect(config.test?.coverage).toMatchObject({ thresholds: COVERAGE_THRESHOLDS.nest });
    expect(pluginNames(config.plugins)).toEqual(['swc', 'extra']);
  });

  it('respeta el perfil que recibe', () => {
    const config = createNestVitestConfig({ profile: 'domain' });

    expect(config.test?.coverage).toMatchObject({ thresholds: COVERAGE_THRESHOLDS.domain });
  });

  it('las opciones de SWC emiten metadatos de los parámetros del constructor y conservan ESM', async () => {
    const output = await transform(DECORATED_SOURCE, {
      filename: 'charge.service.ts',
      jsc: NEST_SWC_OPTIONS.jsc,
    });

    expect(output.code).toContain('"design:paramtypes"');
    expect(output.code).toContain('export class ChargeService');
    expect(output.code).not.toContain('require(');
  });

  it('el plugin que arma la fábrica transforma con esas opciones (metadatos y ESM)', async () => {
    const [swcPlugin] = createNestVitestConfig().plugins as Plugin[];
    const hook = swcPlugin?.transform;
    const handler = typeof hook === 'function' ? hook : hook?.handler;
    if (handler === undefined) {
      throw new Error('El plugin de SWC no expone un hook transform');
    }

    const result: unknown = await Reflect.apply(handler, {}, [
      DECORATED_SOURCE,
      '/virtual/charge.service.ts',
    ]);
    const code: unknown =
      typeof result === 'object' && result !== null ? Reflect.get(result, 'code') : result;

    expect(code).toContain('"design:paramtypes"');
    expect(code).toContain('export class ChargeService');
    expect(code).not.toContain('require(');
  });
});
