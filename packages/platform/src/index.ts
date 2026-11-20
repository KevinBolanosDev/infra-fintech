// API pública del reloj: solo el módulo, los tokens y los modos. Las implementaciones no se exportan
// para que nadie las instancie saltándose `ClockModule.forRoot` y sus reglas (ADR-0011).
export { ClockService, ControllableClockService } from './clock/application/clock.service.js';
export { CLOCK_MODES, type ClockMode } from './clock/application/clock-mode.js';
export { ClockModule, type ClockModuleOptions } from './clock/clock.module.js';
