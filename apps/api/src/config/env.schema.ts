import { APP_ENVS, LOG_LEVELS } from '@repo/observability';
import { z } from 'zod';

const ORIGIN_PATTERN = /^https?:\/\/[^/\s*]+$/;
const BODY_LIMIT_PATTERN = /^\d+(b|kb|mb)$/;

const allowedOrigins = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin !== ''),
  )
  .pipe(
    z.array(
      z
        .string()
        .regex(
          ORIGIN_PATTERN,
          'cada origen debe ser http(s)://host[:puerto], sin ruta ni comodines',
        ),
    ),
  );

const trustProxy = z
  .string()
  .default('false')
  .transform((value, context) => {
    if (value === 'false') {
      return false;
    }
    const hops = Number(value);
    if (!Number.isInteger(hops) || hops < 1 || hops > 10) {
      context.addIssue({
        code: 'custom',
        message: "debe ser 'false' o el número de proxies de confianza (1 a 10)",
      });
      return z.NEVER;
    }
    return hops;
  });

/** Variables de entorno de `apps/api`. Ver `.env.example`. */
export const envSchema = z.object({
  APP_ENV: z.enum(APP_ENVS),
  HTTP_PORT: z
    .string()
    .regex(/^\d+$/, 'debe ser un número de puerto')
    .default('3000')
    .transform(Number)
    .pipe(z.number().int().min(0).max(65_535)),
  ALLOWED_ORIGINS: allowedOrigins,
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  TRUST_PROXY: trustProxy,
  HTTP_BODY_LIMIT: z
    .string()
    .regex(BODY_LIMIT_PATTERN, 'debe ser un tamaño como 100kb o 1mb')
    .default('100kb'),
});

/** Esquema completo: el puerto 0 (aleatorio) solo tiene sentido en `local` y `test`. */
const appEnvSchema = envSchema.superRefine((config, context) => {
  if (config.HTTP_PORT === 0 && config.APP_ENV !== 'local' && config.APP_ENV !== 'test') {
    context.addIssue({
      code: 'custom',
      path: ['HTTP_PORT'],
      message: 'el puerto 0 (aleatorio) solo se permite en local y test',
    });
  }
});

export type AppConfig = z.infer<typeof envSchema>;

/** Error de configuración: nombra las variables y el motivo, nunca sus valores. */
export class EnvValidationError extends Error {
  override readonly name = 'EnvValidationError';

  constructor(readonly problems: readonly string[]) {
    super(`Variables de entorno inválidas: ${problems.join('; ')}`);
  }
}

/** Valida y tipa el entorno. Lanza `EnvValidationError` si algo falta o no es válido. */
export function parseEnv(env: Readonly<Record<string, string | undefined>>): AppConfig {
  const result = appEnvSchema.safeParse(env);
  if (result.success) {
    return result.data;
  }
  const problems = result.error.issues.map((issue) => {
    const variable = issue.path.map(String).join('.');
    // Zod 4 no incluye el valor recibido en los issues; se mira el entorno solo para saber si falta.
    const missing = env[String(issue.path[0])] === undefined;
    return `${variable} (${missing ? 'falta' : issue.message})`;
  });
  throw new EnvValidationError(problems);
}
