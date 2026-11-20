import { APP_ENVS } from '@repo/observability';

/** Modo del reloj de negocio (`CLOCK_MODE`). */
export const CLOCK_MODES = ['system', 'controllable'] as const;
export type ClockMode = (typeof CLOCK_MODES)[number];

/**
 * Ambientes donde se permite el reloj controlable: todos los conocidos salvo `production`. Es una
 * lista de permitidos: un ambiente desconocido (o mal escrito) nunca lo habilita (ADR-0011).
 */
export const CONTROLLABLE_CLOCK_ENVS: readonly string[] = APP_ENVS.filter(
  (env) => env !== 'production',
);

export interface ClockModeConfig {
  readonly mode: ClockMode;
  readonly appEnv: string;
  readonly redisUrl?: string | undefined;
}

/**
 * Reglas del modo del reloj (ADR-0011). Falla cerrado: un modo o un ambiente que no se reconoce se
 * rechaza; el controlable solo en los ambientes permitidos y siempre con Redis. Los mensajes nombran
 * la regla, nunca valores (salvo el modo y el ambiente, que no son secretos).
 */
export function assertClockModeAllowed({ mode, appEnv, redisUrl }: ClockModeConfig): void {
  if (!(CLOCK_MODES as readonly string[]).includes(mode)) {
    throw new Error(`CLOCK_MODE desconocido: use ${CLOCK_MODES.join(' o ')}`);
  }
  if (!(APP_ENVS as readonly string[]).includes(appEnv)) {
    throw new Error('APP_ENV desconocido para el reloj de negocio');
  }
  if (mode === 'system') {
    return;
  }
  if (!CONTROLLABLE_CLOCK_ENVS.includes(appEnv)) {
    throw new Error('CLOCK_MODE=controllable no se permite con APP_ENV=production');
  }
  if (redisUrl === undefined || redisUrl.trim() === '') {
    throw new Error('CLOCK_MODE=controllable exige REDIS_URL');
  }
}
