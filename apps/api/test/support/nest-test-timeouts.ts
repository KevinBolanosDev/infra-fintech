import { createApp } from '../../src/create-app.js';

/**
 * Arrancar Nest por primera vez en un proceso carga en frío `@nestjs/*`, Express, helmet y los
 * módulos transformados por SWC: con carga en paralelo (tareas de Turbo, CI con pocos núcleos) supera
 * los 5 s por defecto de Vitest. Ese costo se paga una vez en un calentamiento con su propio límite, y
 * los `describe` que arrancan Nest usan un límite acotado. El perfil unitario global no cambia.
 */
export const NEST_WARMUP_TIMEOUT_MS = 60_000;
export const NEST_TEST_TIMEOUT_MS = 20_000;

/** Crea, inicia y cierra una app mínima para cargar Nest antes de las pruebas medidas. */
export async function warmUpNest(): Promise<void> {
  const { app } = await createApp({ APP_ENV: 'test', LOG_LEVEL: 'silent' });
  await app.init();
  await app.close();
}
