import { describe, expect, it } from 'vitest';

import { createPrismaClient } from './client.js';

// Dirección sintética: crear el cliente no conecta, así que no hace falta una base.
const CONNECTION_STRING = 'postgresql://usuario:clave-sintetica@127.0.0.1:1/inexistente';

describe('createPrismaClient', () => {
  it('crea un PrismaClient sin conectarse a la base', async () => {
    const client = createPrismaClient({ connectionString: CONNECTION_STRING });
    // Prisma devuelve un Proxy (ni `instanceof` ni los comparadores de objetos de Vitest sirven):
    // se comprueba la forma pública del cliente.
    expect(typeof client.$connect).toBe('function');
    expect(typeof client.$transaction).toBe('function');
    await client.$disconnect();
  });

  it.each(['', '   '])('rechaza una cadena de conexión vacía (%j)', (connectionString) => {
    expect(() => createPrismaClient({ connectionString })).toThrow('connectionString vacía');
  });
});
