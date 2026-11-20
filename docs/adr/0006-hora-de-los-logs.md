# ADR-0006 — Excepción de reloj para la hora de los logs y regla de ESLint

| Campo | Valor |
| --- | --- |
| Estado | Aceptado (aprobado por el usuario el 2026-11-18, checkpoint de la sub-fase 0.7, decisión D1) |
| Fecha | 2026-11-18 |
| Decisores | Usuario (dueño del proyecto) |
| Sub-fase / fase | 0.7 (Fase 0); afecta a 0.8 y 0.12 |
| Relacionado con | Regla 6 de `CLAUDE.md` ("Reloj inyectable"); `packages/observability`; `ClockService` (0.12) |

## Contexto

La regla 6 de `CLAUDE.md` decía "nada lee la hora del sistema; todo pasa por `ClockService`", sin excepciones. El logger (`@repo/observability`, 0.7) pone la hora real en cada línea mediante `pino.stdTimeFunctions.isoTime`. Usar `ClockService` ahí es imposible por las reglas de dependencia (`platform` importa `observability`, no al revés) y además sería incorrecto: en `sandbox` el reloj de negocio puede estar adelantado, pero un log debe decir cuándo ocurrió algo de verdad para poder correlacionarlo con la infraestructura.

La regla tampoco se hacía cumplir mecánicamente.

## Decisión

1. **Excepción única:** la hora de cada línea de log en `packages/observability` es la hora real del sistema. Es hora operativa, no de negocio. Se puede inyectar con la opción `timestamp` de `createLogger`.
2. **Regla de ESLint** en `@repo/config/eslint/base` (`no-restricted-syntax`, `SYSTEM_TIME_RESTRICTIONS`): prohíbe `Date.now` (llamada o referencia, también `Date['now']` y `globalThis.Date.now`), `new Date()` y `new globalThis.Date()` sin argumentos, y `Date()`. `new Date(valor)` y `Date.parse(...)` se permiten (construyen o interpretan fechas, no leen el reloj).
   - Es una regla de buena fe, no una barrera: no atrapa `const { now } = Date`, `new Date(undefined)`, `Reflect.get(Date, 'now')` ni `Intl.DateTimeFormat().format()`. La revisión cubre el resto.
   - `no-restricted-syntax` es una sola regla: una configuración que añada sus propias restricciones debe incluir estas (`['error', ...SYSTEM_TIME_RESTRICTIONS, ...propias]`) o las reemplazaría.
   - Se aplica a **todo** el código, **también a pruebas y archivos de configuración**: las pruebas usan fechas explícitas o un reloj inyectado, para ser deterministas.
   - Solo `packages/observability` la desactiva, con la opción explícita `createBaseConfig({ allowSystemTime: true })`, para todo el paquete. Hoy su código no lee el reloj directamente (lo hace pino); la opción queda para el logger.
   - Pruebas en `packages/config/eslint/base.spec.ts` (negativas en código, `*.spec`, `*.int-spec` y `vitest.config`; positivas con argumentos y con la excepción).
3. **Para la 0.8 y la 0.12:**
   - El logger sigue con la hora real. Cuando el reloj de negocio sea simulado, `api` y `worker` añaden `simulatedAt` (la hora de `ClockService`) mediante el `mixin` del logger.
   - En `test`, el logger usa un `timestamp` fijo.
   - La implementación real de `ClockService` (`SystemClock`, 0.12) es, por definición, el único lugar de negocio que lee el reloj: necesitará su propia excepción acotada a ese archivo. El mecanismo (bloque de ESLint por archivo o `eslint-disable` justificado en línea) se decide al llegar a la 0.12.

## Alternativas consideradas

| Alternativa | Por qué se descarta |
| --- | --- |
| Inyectar `ClockService` en el logger | Imposible por las reglas de dependencia, y daría la hora simulada en lugar de la real |
| Logs sin hora (que la añada el recolector) | Depende de la infraestructura de cada ambiente; en local no habría hora |
| Excepción sin regla de lint | La regla 6 seguiría sin cumplirse de forma mecánica |

## Consecuencias

- `CLAUDE.md` (regla 6) recoge la excepción y la regla de lint.
- Las pruebas no pueden usar `new Date()` para "ahora": usan fechas fijas o el reloj controlable (0.12).
- La regla no cubre `performance.now()` ni `process.hrtime()` (miden duración, no fecha); si se usan para lógica de negocio, la revisión lo detecta.

## Seguimiento (2026-11-20, sub-fase 0.12)

Sin cambiar la decisión: la excepción de `SystemClock` quedó resuelta con la opción `systemClockFiles` de `createBaseConfig` (ADR-0011). El `simulatedAt` del punto 3 se pospone a la Fase 2, con el panel de simulación (ADR-0011, punto 9).

## Verificación

```bash
pnpm turbo run test --filter=@repo/config   # base.spec.ts: regla de reloj
pnpm lint
```
