import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';

import { HealthService, type HealthStatus } from './health.service.js';

/** `GET /health`, fuera del prefijo de versión (`/v1`). */
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  // Sin @Inject: la dependencia se resuelve por los metadatos del decorador (emitDecoratorMetadata).
  constructor(private readonly health: HealthService) {}

  @Get()
  check(): HealthStatus {
    return this.health.check();
  }
}
