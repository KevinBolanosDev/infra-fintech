import { describe, expect, it, vi } from 'vitest';

import type { createPrismaClient } from './client.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { main, runCli, runSeed, SEED_STEPS } from './seed.js';

function fakeClient() {
  const calls: string[] = [];
  const query = vi.fn(() => {
    calls.push('select 1');
    return Promise.resolve([]);
  });
  const client = {
    $queryRaw: query,
    $disconnect: vi.fn(() => {
      calls.push('disconnect');
      return Promise.resolve();
    }),
  };
  return { client: client as typeof client & Pick<PrismaClient, '$queryRaw'>, query, calls };
}

describe('runSeed', () => {
  it('en la 0.10 no tiene pasos: solo comprueba la conexión', async () => {
    expect(SEED_STEPS).toEqual([]);
    const { client, calls } = fakeClient();
    await runSeed(client);
    expect(calls).toEqual(['select 1', 'disconnect']);
  });

  it('ejecuta los pasos en orden', async () => {
    const { client, calls } = fakeClient();
    await runSeed(client, [
      () => {
        calls.push('a');
        return Promise.resolve();
      },
      () => {
        calls.push('b');
        return Promise.resolve();
      },
    ]);
    expect(calls).toEqual(['select 1', 'a', 'b', 'disconnect']);
  });

  it('desconecta aunque un paso falle', async () => {
    const { client, calls } = fakeClient();
    await expect(
      runSeed(client, [() => Promise.reject(new Error('paso fallido'))]),
    ).rejects.toThrow('paso fallido');
    expect(calls).toEqual(['select 1', 'disconnect']);
  });
});

describe('main', () => {
  it.each([{}, { DATABASE_URL: '  ' }])('exige DATABASE_URL (%j)', async (env) => {
    await expect(main(env)).rejects.toThrow('falta DATABASE_URL');
  });

  it('crea el cliente con DATABASE_URL y ejecuta la semilla', async () => {
    const { client, calls } = fakeClient();
    const create = vi.fn(() => client as unknown as PrismaClient);
    await main({ DATABASE_URL: 'postgresql://sintetico@127.0.0.1:1/x' }, create);
    expect(create).toHaveBeenCalledWith({
      connectionString: 'postgresql://sintetico@127.0.0.1:1/x',
    });
    expect(calls).toEqual(['select 1', 'disconnect']);
  });
});

describe('runCli', () => {
  function output() {
    const lines = { stdout: [] as string[], stderr: [] as string[] };
    return {
      lines,
      io: {
        stdout: { write: (text: string) => lines.stdout.push(text) },
        stderr: { write: (text: string) => lines.stderr.push(text) },
      },
    };
  }

  it('devuelve 0 y lo informa si la semilla termina', async () => {
    const { client } = fakeClient();
    const { lines, io } = output();
    const code = await runCli(
      { DATABASE_URL: 'postgresql://sintetico@127.0.0.1:1/x' },
      io,
      (() => client) as unknown as typeof createPrismaClient,
    );
    expect(code).toBe(0);
    expect(lines.stdout).toEqual(['Semilla aplicada.\n']);
  });

  it('devuelve 1 con solo el mensaje del error, sin la cadena de conexión', async () => {
    const { lines, io } = output();
    const create = (() => {
      throw new Error('fallo sintético');
    }) as unknown as typeof createPrismaClient;
    const code = await runCli({ DATABASE_URL: 'postgresql://u:clave-sintetica@h/x' }, io, create);
    expect(code).toBe(1);
    expect(lines.stderr).toEqual(['Semilla fallida: fallo sintético\n']);
    expect(lines.stderr.join('')).not.toContain('clave-sintetica');
  });

  it('tapa la cadena de conexión si el mensaje del error la cita', async () => {
    const { lines, io } = output();
    const url = 'postgresql://u:clave-sintetica@127.0.0.1:1/x';
    const create = (() => {
      throw new Error(`no se pudo conectar a ${url}`);
    }) as unknown as typeof createPrismaClient;
    expect(await runCli({ DATABASE_URL: url }, io, create)).toBe(1);
    expect(lines.stderr).toEqual(['Semilla fallida: no se pudo conectar a ***\n']);
  });

  it('un valor lanzado que no es Error se informa sin detalles', async () => {
    const { lines, io } = output();
    // Un cliente cuya consulta rechaza con un valor que no es Error.
    const { client, query } = fakeClient();
    query.mockRejectedValueOnce('texto');
    const create = (() => client) as unknown as typeof createPrismaClient;
    expect(await runCli({ DATABASE_URL: 'postgresql://x' }, io, create)).toBe(1);
    expect(lines.stderr).toEqual(['Semilla fallida: error\n']);
  });
});
