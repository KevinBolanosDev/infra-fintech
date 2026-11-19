import { Module } from '@nestjs/common';

import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

/** Módulo técnico (sin las cuatro capas, ADR-0003). */
@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
