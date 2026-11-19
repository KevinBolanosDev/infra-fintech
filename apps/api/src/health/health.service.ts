import { Injectable } from '@nestjs/common';

export interface HealthStatus {
  readonly status: 'ok';
}

/** Vivacidad: responde sin tocar dependencias (base de datos, Redis). */
@Injectable()
export class HealthService {
  check(): HealthStatus {
    return { status: 'ok' };
  }
}
