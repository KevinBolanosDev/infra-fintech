import { EnvValidationError } from './config/env.schema.js';
import { createApp, type CreatedApp } from './create-app.js';

export interface BootstrapDeps {
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Salida de error para los fallos de arranque (antes de que exista el logger). */
  readonly writeError?: (message: string) => void;
  /** Código de salida en caso de error. */
  readonly setExitCode?: (code: number) => void;
}

/**
 * Arranca la API y escucha en `HTTP_PORT`. Si el entorno no es válido escribe un mensaje claro (sin
 * valores) y deja el código de salida en 1, sin lanzar.
 */
export async function bootstrap(deps: BootstrapDeps = {}): Promise<CreatedApp | undefined> {
  const env = deps.env ?? process.env;
  const writeError = deps.writeError ?? ((message: string) => process.stderr.write(`${message}\n`));
  const setExitCode =
    deps.setExitCode ??
    ((code: number) => {
      process.exitCode = code;
    });

  let created: CreatedApp | undefined;
  try {
    created = await createApp(env);
    await created.app.listen(created.config.HTTP_PORT);
    created.logger.info({ port: created.config.HTTP_PORT }, 'api escuchando');
    return created;
  } catch (error) {
    // Si la app llegó a crearse (por ejemplo, falló `listen`), se cierra para liberar conexiones.
    await created?.app.close();
    const message =
      error instanceof EnvValidationError
        ? `No se pudo arrancar la API. ${error.message}`
        : `No se pudo arrancar la API: ${error instanceof Error ? error.message : String(error)}`;
    writeError(message);
    setExitCode(1);
    return undefined;
  }
}
