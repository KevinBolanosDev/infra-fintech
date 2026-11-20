import 'reflect-metadata';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { PROBLEM_JSON_CONTENT_TYPE, problemDetailsSchema } from '@repo/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/create-app.js';
import {
  NEST_TEST_TIMEOUT_MS,
  NEST_WARMUP_TIMEOUT_MS,
  warmUpNest,
} from '../support/nest-test-timeouts.js';
import { TestErrorsModule } from '../support/test-errors.module.js';

const ENV = { APP_ENV: 'test', LOG_LEVEL: 'info', HTTP_BODY_LIMIT: '1kb' };
const REQUEST_ID = '0b5d8a5e-1f3c-4c8e-9a52-6f1f3d2b7c10';

beforeAll(warmUpNest, NEST_WARMUP_TIMEOUT_MS);

describe('Errores RFC 9457 y contexto de petición (e2e)', { timeout: NEST_TEST_TIMEOUT_MS }, () => {
  let app: NestExpressApplication;
  const logLines: string[] = [];
  const logs = () => logLines.map((line) => JSON.parse(line) as Record<string, unknown>);

  beforeAll(async () => {
    ({ app } = await createApp(ENV, {
      extraModules: [TestErrorsModule],
      logDestination: { write: (line: string) => logLines.push(line) },
    }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  /** Toda respuesta de error cumple el contrato y lleva el mismo request_id en cuerpo y cabecera. */
  function expectProblem(response: request.Response, status: number, code: string) {
    expect(response.status).toBe(status);
    expect(response.headers['content-type']).toContain(PROBLEM_JSON_CONTENT_TYPE);
    const problem = problemDetailsSchema.parse(response.body);
    expect(problem.code).toBe(code);
    expect(problem.request_id).toBe(response.headers['x-request-id']);
    return problem;
  }

  it('404: ruta inexistente, instance sin query string', async () => {
    const response = await request(app.getHttpServer()).get('/v1/no-existe?documento=1000000000');
    const problem = expectProblem(response, 404, 'NOT_FOUND');
    expect(problem).toMatchObject({
      type: 'urn:problem-type:not-found',
      instance: '/v1/no-existe',
      details: [],
    });
    expect(JSON.stringify(problem)).not.toContain('1000000000');
  });

  it('400: validación con un detalle por campo', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/pruebas/validacion')
      .send({ monto: -5, concepto: 'ab', inquilino: {} });
    const problem = expectProblem(response, 400, 'VALIDATION_FAILED');
    expect(problem.details.map((detail) => detail.field).sort()).toEqual([
      'concepto',
      'inquilino.documento',
      'monto',
    ]);
  });

  it('la validación deja pasar un cuerpo válido', async () => {
    const body = { monto: 120_000, concepto: 'Arriendo', inquilino: { documento: '1000000000' } };
    await request(app.getHttpServer()).post('/v1/pruebas/validacion').send(body).expect(201, body);
  });

  it('500: excepción no controlada, sin fuga de datos; el log del error lleva el mismo request_id', async () => {
    logLines.length = 0;
    const response = await request(app.getHttpServer())
      .get('/v1/pruebas/error-inesperado')
      .set('X-Request-Id', REQUEST_ID);
    const problem = expectProblem(response, 500, 'INTERNAL_ERROR');

    expect(problem.request_id).toBe(REQUEST_ID);
    expect(JSON.stringify(response.body)).not.toMatch(
      /SELECT|charges|1000000000|detalle interno|Error:|at /,
    );

    const errorLog = logs().find((entry) => entry['msg'] === 'error no controlado');
    expect(errorLog).toMatchObject({ level: 'error', request_id: REQUEST_ID, status: 500 });
    expect(errorLog?.['err']).toMatchObject({ type: 'Error' });
  });

  it('422: excepción de dominio con su código y su mensaje público; 4xx se registra como info', async () => {
    logLines.length = 0;
    const response = await request(app.getHttpServer()).get('/v1/pruebas/error-dominio');
    const problem = expectProblem(response, 422, 'CHARGE_ALREADY_PAID');
    expect(problem).toMatchObject({
      type: 'urn:problem-type:charge-already-paid',
      detail: 'El cobro ya fue pagado.',
    });
    const rejected = logs().find((entry) => entry['msg'] === 'petición rechazada');
    expect(rejected).toMatchObject({
      level: 'info',
      code: 'CHARGE_ALREADY_PAID',
      request_id: problem.request_id,
    });
    expect(rejected).not.toHaveProperty('err');
  });

  it('403: HttpException con texto fijo, nunca el mensaje de la excepción', async () => {
    const response = await request(app.getHttpServer()).get('/v1/pruebas/prohibido');
    const problem = expectProblem(response, 403, 'FORBIDDEN');
    expect(problem.detail).not.toContain('mensaje interno');
  });

  it('errores de body-parser también como problem+json: JSON mal formado y cuerpo demasiado grande', async () => {
    const malformed = await request(app.getHttpServer())
      .post('/v1/pruebas/validacion')
      .set('Content-Type', 'application/json')
      .send('{"monto": ');
    expectProblem(malformed, 400, 'MALFORMED_BODY');

    const tooLarge = await request(app.getHttpServer())
      .post('/v1/pruebas/validacion')
      .send({ relleno: 'x'.repeat(2048) });
    expectProblem(tooLarge, 413, 'PAYLOAD_TOO_LARGE');
    expect(tooLarge.headers['x-content-type-options']).toBe('nosniff');
  });

  it('acepta un X-Request-Id válido y reemplaza uno inválido', async () => {
    const valid = await request(app.getHttpServer()).get('/health').set('X-Request-Id', REQUEST_ID);
    expect(valid.headers['x-request-id']).toBe(REQUEST_ID);

    const invalid = await request(app.getHttpServer())
      .get('/v1/no-existe')
      .set('X-Request-Id', '<script>no-es-un-uuid</script>');
    const problem = expectProblem(invalid, 404, 'NOT_FOUND');
    expect(problem.request_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('dos peticiones concurrentes no mezclan su contexto', async () => {
    const idA = '11111111-1111-4111-8111-111111111111';
    const idB = '22222222-2222-4222-8222-222222222222';
    const [a, b] = await Promise.all([
      request(app.getHttpServer()).get('/v1/pruebas/contexto?espera=40').set('X-Request-Id', idA),
      request(app.getHttpServer())
        .get('/v1/pruebas/contexto?espera=5')
        .set('X-Request-Id', idB)
        .set('X-Correlation-Id', idA),
    ]);
    expect(a.body).toEqual({ requestId: idA, correlationId: idA });
    expect(b.body).toEqual({ requestId: idB, correlationId: idA });
  });
});

describe(
  'El controlador de pruebas no existe en la app de producción',
  { timeout: NEST_TEST_TIMEOUT_MS },
  () => {
    it('createApp rechaza extraModules fuera de APP_ENV=test', async () => {
      await expect(
        createApp(
          { APP_ENV: 'production', LOG_LEVEL: 'silent' },
          { extraModules: [TestErrorsModule] },
        ),
      ).rejects.toThrow('extraModules solo se permite con APP_ENV=test');
    });

    it('sin extraModules, /v1/pruebas/* responde 404 (bootstrap nunca los pasa)', async () => {
      const { app } = await createApp({ APP_ENV: 'test', LOG_LEVEL: 'silent' });
      await app.init();
      for (const path of [
        '/v1/pruebas/error-inesperado',
        '/v1/pruebas/error-dominio',
        '/v1/pruebas/contexto',
      ]) {
        await request(app.getHttpServer()).get(path).expect(404);
      }
      await app.close();
    });
  },
);
