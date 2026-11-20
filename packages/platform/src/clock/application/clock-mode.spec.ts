import { describe, expect, it } from 'vitest';

import type { ClockMode } from './clock-mode.js';
import { assertClockModeAllowed, CLOCK_MODES, CONTROLLABLE_CLOCK_ENVS } from './clock-mode.js';

describe('assertClockModeAllowed', () => {
  it('los modos son system y controllable', () => {
    expect(CLOCK_MODES).toEqual(['system', 'controllable']);
  });

  it.each(['production', 'staging', 'sandbox', 'local', 'test'])(
    'system se permite en %s, sin Redis',
    (appEnv) => {
      expect(() => {
        assertClockModeAllowed({ mode: 'system', appEnv });
      }).not.toThrow();
    },
  );

  it('controllable nunca con APP_ENV=production', () => {
    expect(() => {
      assertClockModeAllowed({
        mode: 'controllable',
        appEnv: 'production',
        redisUrl: 'redis://127.0.0.1:6379',
      });
    }).toThrow('CLOCK_MODE=controllable no se permite con APP_ENV=production');
  });

  it.each([undefined, '', '  '])('controllable exige REDIS_URL (%j)', (redisUrl) => {
    expect(() => {
      assertClockModeAllowed({ mode: 'controllable', appEnv: 'sandbox', redisUrl });
    }).toThrow('CLOCK_MODE=controllable exige REDIS_URL');
  });

  it('el controlable se permite en todos los ambientes conocidos salvo production', () => {
    expect([...CONTROLLABLE_CLOCK_ENVS].sort()).toEqual(['local', 'sandbox', 'staging', 'test']);
  });

  it.each(['Controllable', ' controllable', 'frozen', undefined])(
    'falla cerrado con un modo desconocido (%j), también en producción',
    (mode) => {
      expect(() => {
        assertClockModeAllowed({
          mode: mode as unknown as ClockMode,
          appEnv: 'production',
          redisUrl: 'redis://127.0.0.1:6379',
        });
      }).toThrow('CLOCK_MODE desconocido');
    },
  );

  it.each(['Production', 'production ', 'prod', ''])(
    'falla cerrado con un ambiente desconocido (%j), en cualquier modo',
    (appEnv) => {
      for (const mode of CLOCK_MODES) {
        expect(() => {
          assertClockModeAllowed({ mode, appEnv, redisUrl: 'redis://127.0.0.1:6379' });
        }).toThrow('APP_ENV desconocido');
      }
    },
  );

  it.each(['local', 'test', 'sandbox', 'staging'])('controllable se permite en %s', (appEnv) => {
    expect(() => {
      assertClockModeAllowed({ mode: 'controllable', appEnv, redisUrl: 'redis://127.0.0.1:6379' });
    }).not.toThrow();
  });
});
