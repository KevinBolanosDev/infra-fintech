// @ts-check
import { createBaseConfig } from '@repo/config/eslint/base';

// Única excepción a la regla de reloj (ADR-0006): la hora de cada línea de log es operativa.
export default createBaseConfig({ tsconfigRootDir: import.meta.dirname, allowSystemTime: true });
