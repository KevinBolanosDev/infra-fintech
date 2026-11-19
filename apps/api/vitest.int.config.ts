import { createNestVitestConfig } from '@repo/config/vitest/nest';

// Integración contra el proceso compilado (dist/main.js): arranque con variables inválidas y cierre con SIGTERM.
export default createNestVitestConfig({ kind: 'integration' });
