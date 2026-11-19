import { AsyncLocalStorage } from 'node:async_hooks';

/** Datos de la ejecución en curso (petición HTTP, tarea del worker…), disponibles sin pasar parámetros. */
export interface ExecutionContextStore {
  /** Identificador de esta ejecución (por ejemplo, la petición HTTP). */
  readonly requestId: string;
  /** Identificador que se propaga entre servicios y tareas de una misma operación. */
  readonly correlationId: string;
  /** Usuario o sistema que origina la ejecución, si se conoce. */
  readonly actorId?: string;
  /** IP de origen, si aplica. Es un dato personal: el logger no la escribe. */
  readonly ip?: string;
  /** Agente de usuario (`User-Agent`), si aplica. El logger no lo escribe. */
  readonly userAgent?: string;
}

/** Contexto de ejecución basado en `AsyncLocalStorage`; no depende de NestJS. */
export class ExecutionContext {
  readonly #storage = new AsyncLocalStorage<ExecutionContextStore>();

  /** Ejecuta `fn` con `store` como contexto; todo lo asíncrono que lance lo hereda. */
  run<T>(store: ExecutionContextStore, fn: () => T): T {
    return this.#storage.run(store, fn);
  }

  /** Contexto de la ejecución en curso, o `undefined` fuera de un `run`. */
  get(): ExecutionContextStore | undefined {
    return this.#storage.getStore();
  }
}

/** Contexto compartido por el proceso (api, worker). */
export const executionContext = new ExecutionContext();
