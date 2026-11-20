import { Injectable } from '@nestjs/common';

import { ClockService } from '../application/clock.service.js';

/**
 * Reloj de producción: la hora real del sistema. Es el **único** archivo de negocio que la lee
 * (excepción de ESLint `systemClockFiles` acotada a este archivo, ADR-0011).
 */
@Injectable()
export class SystemClock extends ClockService {
  now(): Promise<Date> {
    return Promise.resolve(new Date());
  }
}
