import 'reflect-metadata';

import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/create-app.js';
import {
  NEST_TEST_TIMEOUT_MS,
  NEST_WARMUP_TIMEOUT_MS,
  warmUpNest,
} from '../support/nest-test-timeouts.js';

const ALLOWED = 'https://app.example.test';

/** La instancia de Express detrás de la app (para leer `trust proxy`). */
function expressOf(app: NestExpressApplication): { get: (key: string) => unknown } {
  return app.getHttpAdapter().getInstance() as { get: (key: string) => unknown };
}

beforeAll(warmUpNest, NEST_WARMUP_TIMEOUT_MS);

describe('API (e2e en proceso)', { timeout: NEST_TEST_TIMEOUT_MS }, () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    ({ app } = await createApp({
      APP_ENV: 'test',
      LOG_LEVEL: 'silent',
      ALLOWED_ORIGINS: ALLOWED,
      HTTP_BODY_LIMIT: '1kb',
    }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health responde 200 sin prefijo de versión', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('no expone x-powered-by y envía las cabeceras de helmet', async () => {
    const response = await request(app.getHttpServer()).get('/health');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['strict-transport-security']).toBeDefined();
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('CORS permite un origen de la lista', async () => {
    const response = await request(app.getHttpServer()).get('/health').set('Origin', ALLOWED);
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('CORS rechaza un origen que no está en la lista (también en el preflight)', async () => {
    const other = 'https://intruso.example.test';
    const simple = await request(app.getHttpServer()).get('/health').set('Origin', other);
    expect(simple.headers['access-control-allow-origin']).toBeUndefined();

    const preflight = await request(app.getHttpServer())
      .options('/v1/cobros')
      .set('Origin', other)
      .set('Access-Control-Request-Method', 'POST');
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('las rutas de negocio viven en /v1 (todavía no hay ninguna)', async () => {
    await request(app.getHttpServer()).get('/v1/health').expect(404);
    await request(app.getHttpServer()).get('/v1/cobros').expect(404);
  });

  it('rechaza un cuerpo mayor que HTTP_BODY_LIMIT con 413, también con helmet en el error', async () => {
    const json = await request(app.getHttpServer())
      .post('/v1/cobros')
      .set('Content-Type', 'application/json')
      .send({ relleno: 'x'.repeat(2048) })
      .expect(413);
    expect(json.headers['x-content-type-options']).toBe('nosniff');
    expect(json.headers['x-powered-by']).toBeUndefined();

    await request(app.getHttpServer())
      .post('/v1/cobros')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(`relleno=${'x'.repeat(2048)}`)
      .expect(413);
  });

  it('trust proxy queda desactivado por defecto', () => {
    expect(expressOf(app).get('trust proxy')).toBe(false);
  });
});

describe('API fuera de test', { timeout: NEST_TEST_TIMEOUT_MS }, () => {
  it('aplica TRUST_PROXY como número de proxies y arranca con la hora real del logger', async () => {
    const { app, config } = await createApp({
      APP_ENV: 'production',
      LOG_LEVEL: 'silent',
      TRUST_PROXY: '2',
    });
    const express = expressOf(app);
    expect(config.TRUST_PROXY).toBe(2);
    expect(express.get('trust proxy')).toBe(2);
    await app.close();
  });
});
