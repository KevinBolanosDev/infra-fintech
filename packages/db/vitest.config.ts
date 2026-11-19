import { createNodeVitestConfig } from '@repo/config/vitest/node';

// Perfil utility más el 85 % de líneas aprobado para `db` (Q-6, sub-fase 0.10). El cliente generado
// (`src/generated/**`) nunca cuenta para la cobertura.
export default createNodeVitestConfig({ thresholds: { lines: 85 } });
