import 'reflect-metadata';

import { Test } from '@nestjs/testing';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  NEST_TEST_TIMEOUT_MS,
  NEST_WARMUP_TIMEOUT_MS,
  warmUpNest,
} from '../../test/support/nest-test-timeouts.js';
import { HealthController } from './health.controller.js';
import { HealthModule } from './health.module.js';
import { HealthService } from './health.service.js';

beforeAll(warmUpNest, NEST_WARMUP_TIMEOUT_MS);

describe('HealthController', { timeout: NEST_TEST_TIMEOUT_MS }, () => {
  it('Nest inyecta HealthService por los metadatos del decorador (ESM + SWC, sin @Inject)', async () => {
    // Criterio 1 de la 0.8: sin `emitDecoratorMetadata` el constructor recibiría `undefined`.
    expect(Reflect.getMetadata('design:paramtypes', HealthController)).toEqual([HealthService]);

    const moduleRef = await Test.createTestingModule({ imports: [HealthModule] }).compile();
    const controller = moduleRef.get(HealthController);

    expect(controller.check()).toEqual({ status: 'ok' });
    await moduleRef.close();
  });

  it('usa el servicio inyectado (sustituible en pruebas)', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [HealthModule] })
      .overrideProvider(HealthService)
      .useValue({ check: () => ({ status: 'ok', fake: true }) })
      .compile();

    expect(moduleRef.get(HealthController).check()).toEqual({ status: 'ok', fake: true });
    await moduleRef.close();
  });
});
