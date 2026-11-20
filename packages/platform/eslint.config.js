// @ts-check
import { createBaseConfig } from '@repo/config/eslint/base';

// Excepción acotada a un solo archivo (ADR-0011): SystemClock es la única lectura de la hora de
// negocio del backend. Cualquier otro archivo de platform sigue bajo la regla de reloj (ADR-0006).
export default createBaseConfig({
  tsconfigRootDir: import.meta.dirname,
  systemClockFiles: ['src/clock/infrastructure/system.clock.ts'],
});
