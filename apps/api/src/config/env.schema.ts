import { APP_ENVS, LOG_LEVELS } from '@repo/observability';
import { z } from 'zod';

/** `http(s)://host[:puerto]`: sin `*`, sin ruta, sin barra final, sin espacios. */
const ORIGIN_PATTERN = /^https?:\/\/[^/\s*]+$/;
/** Hosts de la propia máquina: no son orígenes válidos fuera de `local` y `test`. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
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
          'cada origen debe ser http(s)://host[:puerto], sin ruta, barra final ni comodines',
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

function isLoopbackOrigin(origin: string): boolean {
  const { hostname } = new URL(origin);
  return LOOPBACK_HOSTS.has(hostname) || hostname.endsWith('.localhost');
}

/**
 * Reglas que dependen del ambiente. Fuera de `local` y `test`: el puerto 0 (aleatorio) no se permite y
 * cada origen de CORS debe ser `https://` y no apuntar a la propia máquina.
 */
const appEnvSchema = envSchema.superRefine((config, context) => {
  const isDevelopment = config.APP_ENV === 'local' || config.APP_ENV === 'test';
  if (
    !isDevelopment &&
    config.ALLOWED_ORIGINS.some(
      (origin) => !origin.startsWith('https://') || isLoopbackOrigin(origin),
    )
  ) {
    context.addIssue({
      code: 'custom',
      path: ['ALLOWED_ORIGINS'],
      message:
        'fuera de local y test cada origen debe ser https:// y no localhost, 127.0.0.1 ni ::1',
    });
  }
  if (config.HTTP_PORT === 0 && !isDevelopment) {
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
