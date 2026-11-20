import 'reflect-metadata';

import { request as httpRequest } from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/create-app.js';
import {
  NEST_TEST_TIMEOUT_MS,
  NEST_WARMUP_TIMEOUT_MS,
  warmUpNest,
} from '../support/nest-test-timeouts.js';
import { TestErrorsModule } from '../support/test-errors.module.js';

interface Reply {
  readonly status?: number;
  readonly requestIdHeader?: string;
  readonly body: Record<string, unknown>;
}

/** POST con el cuerpo troceado (Transfer-Encoding: chunked) y pausas entre trozos. */
function chunkedPost(
  port: number,
  path: string,
  requestId: string,
  chunks: string[],
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
      },
      (response) => {
        let data = '';
        response.on('data', (chunk: Buffer) => (data += chunk.toString()));
        response.on('end', () => {
          resolve({
            status: response.statusCode,
            requestIdHeader: response.headers['x-request-id'] as string | undefined,
            body: JSON.parse(data) as Record<string, unknown>,
          });
        });
      },
    );
    req.on('error', reject);
    void (async () => {
      for (const chunk of chunks) {
        req.write(chunk);
        await sleep(15);
      }
      req.end();
    })();
  });
}

beforeAll(warmUpNest, NEST_WARMUP_TIMEOUT_MS);

describe(
  'Contexto de petición con cuerpos troceados (body-parser asíncrono)',
  { timeout: NEST_TEST_TIMEOUT_MS },
  () => {
    let app: NestExpressApplication;
    let port: number;
    const logLines: string[] = [];

    beforeAll(async () => {
      ({ app } = await createApp(
        { APP_ENV: 'test', LOG_LEVEL: 'info', HTTP_PORT: '0' },
        {
          extraModules: [TestErrorsModule],
          logDestination: { write: (line: string) => logLines.push(line) },
        },
      ));
      await app.listen(0, '127.0.0.1');
      port = (app.getHttpServer().address() as { port: number }).port;
    });

    afterAll(async () => {
      await app.close();
    });

    it('el handler ve el contexto de su petición aunque el cuerpo llegue en trozos, también en concurrencia', async () => {
      const idA = '33333333-3333-4333-8333-333333333333';
      const idB = '44444444-4444-4444-8444-444444444444';
      const [a, b] = await Promise.all([
        chunkedPost(port, '/v1/pruebas/contexto', idA, ['{"a":', '1,"b":', '"x"}']),
        chunkedPost(port, '/v1/pruebas/contexto', idB, ['{"c":', '2}']),
      ]);
      expect(a.body).toEqual({ requestId: idA, correlationId: idA, received: { a: 1, b: 'x' } });
      expect(b.body).toEqual({ requestId: idB, correlationId: idB, received: { c: 2 } });
    });

    it('un error de body-parser con cuerpo troceado conserva el request_id en cuerpo, cabecera y log', async () => {
      logLines.length = 0;
      const id = '55555555-5555-4555-8555-555555555555';
      const reply = await chunkedPost(port, '/v1/pruebas/contexto', id, ['{"roto":', ' tru']);
      expect(reply.status).toBe(400);
      expect(reply.body).toMatchObject({ code: 'MALFORMED_BODY', request_id: id });
      expect(reply.requestIdHeader).toBe(id);
      const rejected = logLines
        .map((line) => JSON.parse(line) as Record<string, unknown>)
        .find((entry) => entry['msg'] === 'petición rechazada');
      expect(rejected).toMatchObject({ request_id: id, code: 'MALFORMED_BODY' });
    });
  },
);
