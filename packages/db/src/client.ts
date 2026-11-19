import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client.js';

export interface CreatePrismaClientOptions {
  /** Cadena de conexión de PostgreSQL. Quien llama la obtiene de su configuración validada. */
  readonly connectionString: string;
}

/**
 * Crea un `PrismaClient` con el adaptador `pg` (Prisma 7 exige un adaptador de controlador).
 * No lee el entorno ni abre conexiones: la primera consulta (o `$connect()`) conecta.
 */
export function createPrismaClient({ connectionString }: CreatePrismaClientOptions): PrismaClient {
  if (connectionString.trim() === '') {
    throw new Error('createPrismaClient: connectionString vacía');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
