import { type ChildProcess, spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { Agent, get } from 'node:http';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// Se prueba el artefacto compilado (Turbo construye la api antes de `test:int`).
const MAIN = fileURLToPath(new URL('../../dist/main.js', import.meta.url));

interface Exit {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
}

function start(env: Record<string, string>): { child: ChildProcess; exited: Promise<Exit> } {
  // Entorno mínimo y sintético: nada del entorno del desarrollador llega al proceso.
  const child = spawn(process.execPath, [MAIN], {
    env: { PATH: process.env['PATH'] ?? '', ...env },
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
  child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
  const exited = new Promise<Exit>((resolve) => {
    child.on('exit', (code, signal) => {
      resolve({ code, signal, stdout, stderr });
    });
  });
  return { child, exited };
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => {
        resolve(port);
      });
    });
  });
}

function waitForOutput(child: ChildProcess, text: string): Promise<void> {
  return new Promise((resolve) => {
    let buffer = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      if (buffer.includes(text)) {
        resolve();
      }
    });
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => {
        reject(new Error(`timeout: ${what}`));
      }, ms),
    ),
  ]);
}

describe('dist/', () => {
  it('no contiene código de pruebas (ni el controlador de errores de prueba ni *.spec)', () => {
    const files = readdirSync(fileURLToPath(new URL('../../dist/', import.meta.url)), {
      recursive: true,
    }).map(String);
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((file) => /spec|test-errors|support/.test(file))).toEqual([]);
  });
});

describe('dist/main.js', () => {
  it('con una variable inválida falla con un mensaje claro y código distinto de 0', async () => {
    const { exited } = start({ APP_ENV: 'valor-sintetico-invalido', HTTP_PORT: '1' });
    const result = await withTimeout(exited, 15_000, 'salida del proceso');

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      'No se pudo arrancar la API. Variables de entorno inválidas: APP_ENV',
    );
    expect(result.stderr).not.toContain('valor-sintetico-invalido');
  });

  it('sin variables de entorno también falla con código 1 y dice qué falta', async () => {
    const { exited } = start({});
    const result = await withTimeout(exited, 15_000, 'salida del proceso');

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('APP_ENV (falta)');
  });

  it('SIGTERM cierra la app y sus conexiones (también las keep-alive abiertas)', async () => {
    const port = await freePort();
    const { child, exited } = start({
      APP_ENV: 'test',
      HTTP_PORT: String(port),
      LOG_LEVEL: 'info',
    });
    await withTimeout(waitForOutput(child, 'api escuchando'), 15_000, 'arranque');

    const agent = new Agent({ keepAlive: true });
    let socketClosed = false;
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const request = get({ host: '127.0.0.1', port, path: '/health', agent }, (response) => {
        response.resume();
        response.on('end', () => {
          resolve(response.statusCode);
        });
      });
      request.on('socket', (socket) => {
        socket.on('close', () => (socketClosed = true));
      });
      request.on('error', reject);
    });
    expect(status).toBe(200);
    expect(socketClosed).toBe(false);

    // El controlador solo de pruebas no existe en el artefacto: 404 como problem+json.
    const probe = await new Promise<{ status?: number; type?: string; body: string }>(
      (resolve, reject) => {
        get({ host: '127.0.0.1', port, path: '/v1/pruebas/error-inesperado' }, (response) => {
          let body = '';
          response.on('data', (chunk: Buffer) => (body += chunk.toString()));
          response.on('end', () => {
            resolve({ status: response.statusCode, type: response.headers['content-type'], body });
          });
        }).on('error', reject);
      },
    );
    expect(probe.status).toBe(404);
    expect(probe.type).toContain('application/problem+json');
    expect(JSON.parse(probe.body)).toMatchObject({ code: 'NOT_FOUND' });

    child.kill('SIGTERM');
    const result = await withTimeout(exited, 10_000, 'cierre tras SIGTERM');

    // Nest cierra la app y vuelve a enviarse la señal: sale por SIGTERM (o con código 0). La línea
    // de cierre solo existe si corrió el cierre ordenado (`enableShutdownHooks` + `ShutdownLogger`).
    expect(result.signal === 'SIGTERM' || result.code === 0).toBe(true);
    expect(result.stdout).toContain('api cerrada (SIGTERM)');
    expect(socketClosed).toBe(true);
    agent.destroy();
  });
});
