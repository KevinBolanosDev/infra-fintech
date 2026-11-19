// @ts-check
import { createBaseConfig } from '@repo/config/eslint/base';

// El cliente generado (src/generated/) ya está ignorado en la configuración base.
export default createBaseConfig({ tsconfigRootDir: import.meta.dirname });
