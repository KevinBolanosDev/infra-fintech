import { createVitestConfig } from '@repo/config/vitest/base';

// Perfil domain (90 % de ramas): reglas y tipos puros, sin Node ni dependencias externas.
export default createVitestConfig({ profile: 'domain' });
