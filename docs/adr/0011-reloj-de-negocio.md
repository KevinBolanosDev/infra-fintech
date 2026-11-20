# ADR-0011 — Reloj de negocio (`ClockService`), excepción de ESLint y traslado de `DomainError`

| Campo | Valor |
| --- | --- |
| Estado | Aceptado (decisiones del usuario D-13 y Q-1 a Q-10 de la sub-fase 0.12, 2026-11-20); pendiente de la revisión humana del checkpoint de la 0.12 |
| Fecha | 2026-11-20 |
| Decisores | Usuario (dueño del proyecto) |
| Sub-fase / fase | 0.12 (Fase 0) |
| Relacionado con | Regla 6 de `CLAUDE.md`; ADR-0003 (capas y `platform`); ADR-0006 (hora de los logs); ADR-0008 (`DomainError`); ADR-0009 (fechas en la base); ADR-0010 (harness) |

## Contexto

La regla 6 de `CLAUDE.md` exige que nada lea la hora del sistema salvo `ClockService`. Vencimientos, mora, conciliación y asientos dependen de esa hora, y el MVP necesita adelantar el tiempo en sandbox (panel de simulación, Fase 2). El plan definía el puerto como `Clock { now(): Date }`, síncrono.

## Decisión

1. **Alcance (D-13 = A):** `SystemClock` (hora real) y un reloj controlable respaldado en Redis (`now`, `set`, `advance(ms)`), elegidos por `CLOCK_MODE` (`system` por defecto, `controllable`). Los avances por calendario (día, semana, mes en `America/Bogota`) quedan para la Fase 2.
2. **Puerto asíncrono (cambia el contrato del plan):** `Clock { now(): Promise<Date> }` en `@repo/domain` (solo tipos). El reloj controlable vive en Redis y todas las instancias deben ver el mismo instante; un puerto síncrono obligaría a copias locales que pueden divergir. Solo la capa `application` llama al reloj; las funciones de dominio siguen puras y reciben la fecha como argumento.
3. **Reloj controlable = desfase en Redis:** clave `fintech:clock:offset_ms` (entero en milisegundos; sin clave, 0). `now = hora del sistema + desfase`, así que el tiempo sigue corriendo. `set(instant)` es un `SET` del desfase y `advance(ms)` un `INCRBY`: ambos atómicos. No lee la hora: se la pide al `SystemClock` inyectado. Conexión `ioredis` propia, perezosa, con `REDIS_URL`; se cierra al apagar la app.
4. **Restricciones del modo:** `controllable` nunca con `APP_ENV=production` y siempre con `REDIS_URL`. Se valida dos veces: en el esquema de entorno de la api y en `ClockModule.forRoot` (la app no arranca). La segunda defensa **falla cerrado**: un `CLOCK_MODE` o un `APP_ENV` desconocidos (por ejemplo `Controllable` o `Production`) se rechazan, y el controlable solo se admite en la lista de ambientes permitidos (`local`, `test`, `sandbox`, `staging`: todos los de `APP_ENVS` salvo `production`). El índice de `@repo/platform` solo exporta `ClockModule`, los tokens y los modos: las implementaciones no se pueden instanciar desde fuera saltándose esas reglas.
   - Robustez: el desfase guardado debe ser un entero canónico (`/^-?\d+$/`); `now()` falla antes que devolver un `Invalid Date`; `advance` rechaza valores fuera del rango de un `Date`. La conexión a Redis tiene `connectTimeout` de 5 s y `commandTimeout` de 2 s, sus errores no se escriben por consola (llegan como rechazo de cada comando) y el cierre no falla si la conexión cayó. Con Redis caído, `now()` rechaza: falla cerrado, aceptable porque el modo controlable solo existe fuera de producción.
5. **Estructura (ADR-0003):** `packages/platform/src/clock/` con `application/` (`ClockService`, clase abstracta que sirve de token de inyección e implementa `Clock`; `ControllableClockService`; reglas del modo), `infrastructure/` (`system.clock.ts`, `redis-controllable.clock.ts`, conexión) y `clock.module.ts` (raíz de composición, módulo global). En la api, `AppModule` importa `ClockModule.forRoot`.
6. **Excepción de ESLint (cierra lo pendiente de ADR-0006):** `createBaseConfig({ systemClockFiles })` desactiva la regla de reloj solo en las rutas exactas indicadas: relativas, sin `..`, sin comodines ni barras invertidas, y con nombre de archivo exactamente `system.clock.ts`. Únicamente `packages/platform/eslint.config.js` la usa, con `src/clock/infrastructure/system.clock.ts`. Pruebas: ese archivo puede leer la hora; sus vecinos (otros archivos de `infrastructure/`, su spec, el módulo, otro `system.clock.ts` en otra ruta) no.
7. **Reloj manual para pruebas:** `ManualClock` en `@repo/testing` (`set`, `advance`), sobre el mismo puerto.
8. **`DomainError` pasa a `@repo/domain`** (lo anunciaba ADR-0008) con su propio `ERROR_CODE_PATTERN`. Como `domain` y `contracts` no pueden importarse entre sí, `@repo/contracts` conserva su copia y una prueba de `apps/api` (que ve los dos) exige que coincidan. Se retira `apps/api/src/common/errors/`.
9. **`simulatedAt` en los logs (pospuesto):** el compromiso de ADR-0006 (añadir la hora de negocio a cada log cuando el reloj es simulado) se difiere a la Fase 2, con el panel de simulación. El `mixin` de pino es síncrono y el puerto ya no lo es; habrá que resolverlo entonces (por ejemplo, con el desfase guardado en el contexto de la petición).

## Alternativas consideradas

| Alternativa | Por qué se descarta |
| --- | --- |
| Puerto síncrono con copia local sincronizada por pub/sub | Ventanas en que las instancias ven instantes distintos; más código |
| Instante congelado en Redis | Un sandbox quedaría quieto: reintentos y expiraciones no avanzarían. El determinismo de las pruebas lo da `ManualClock` |
| `eslint-disable` en línea en `SystemClock` | Disperso y sin prueba; la opción de configuración se ve y se prueba |
| Archivos planos en `platform/clock/` (como listaba el plan) | Las fronteras esperan capas dentro de cada módulo (ADR-0003) |

## Consecuencias

- **Revisión humana:** esta pieza fija la hora de vencimientos, mora y asientos. Cualquier cambio en `SystemClock`, en la clave de Redis o en las reglas del modo pasa por revisión.
- Todo caso de uso que necesite "ahora" hace `await clock.now()` una vez y pasa el `Date` a las funciones puras.
- Las columnas con hora de negocio reciben el valor del reloj, no `DEFAULT now()` (ADR-0009).
- Con el reloj controlable, todo tiempo de espera de negocio (relevo del `outbox`, expiración de llaves de idempotencia) se calcula con el reloj, nunca con `setTimeout` y aritmética de fechas.
- La regla 6 de `CLAUDE.md` debe nombrar esta segunda excepción (diff preparado para revisión humana en la 0.12).

## Verificación

```bash
pnpm turbo run lint typecheck test --filter=@repo/domain --filter=@repo/platform
pnpm test:int        # dos instancias de Nest ven el mismo instante controlado (Redis del harness)
pnpm lint:boundaries
```
