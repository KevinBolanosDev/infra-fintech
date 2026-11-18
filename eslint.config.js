// @ts-check
// Configuración de ESLint para los archivos de la raíz. Cada paquete y app tiene su propio
// eslint.config.js que reexporta @repo/config/eslint/base (ESLint 10 usa el más cercano a cada archivo).
import { createBaseConfig } from '@repo/config/eslint/base';

export default createBaseConfig({ tsconfigRootDir: import.meta.dirname });
