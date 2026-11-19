# @repo/observability

Logger JSON (pino) que nunca escribe datos personales y contexto de ejecución (`request_id`, `correlation_id`) disponible sin pasar parámetros. No depende de NestJS, `domain`, `db` ni de ninguna app (lo verifica `pnpm lint:boundaries`).

## Uso

```ts
import { createLogger, executionContext } from '@repo/observability';

const logger = createLogger({ service: 'api', level: 'info', appEnv: 'production' });

executionContext.run({ requestId: 'req-123', correlationId: 'corr-123' }, () => {
  logger.info({ chargeId: 'c-1', tenant: { email: 'persona@example.test' } }, 'cobro creado');
});
// {"level":"info","time":"…","service":"api","app_env":"production","request_id":"req-123",
//  "correlation_id":"corr-123","chargeId":"c-1","tenant":{"email":"[REDACTED]"},"msg":"cobro creado"}
```

- Salida JSON por stdout; en `appEnv: 'local'` usa `pino-pretty` (dependencia de desarrollo).
- `request_id` y `correlation_id` se agregan a cada línea emitida dentro de `executionContext.run(...)`. El actor y la IP viven en el contexto pero el logger no los escribe.
- La hora de cada línea es la real (ISO). Es hora operativa, no de negocio, así que no pasa por `ClockService`; se puede inyectar con la opción `timestamp`. Es la única excepción a la regla de reloj (ADR-0006): este paquete es el único con `allowSystemTime` en ESLint.

## Enmascarado

`redact()` reemplaza por `[REDACTED]` el valor de toda clave sensible, a cualquier profundidad, en el objeto del log y en los bindings de los loggers hijos y nietos. Recorre objetos planos, arreglos, instancias de clases (DTOs, entidades), errores (sus propiedades propias, como la configuración HTTP con cabeceras o el `meta` de Prisma, y su `cause`) y objetos con `toJSON` (lo mismo que escribiría `JSON.stringify`). Las claves se comparan normalizadas (minúsculas, sin acentos ni separadores):

- Lista exacta (`SENSITIVE_KEYS`): documento (`document`, `documento`, `cedula`, `nit`, `dni`, `pasaporte`…), correo (`email`, `correo`…), teléfono (`phone`, `telefono`, `celular`…), contraseñas y códigos (`password`, `contrasena`, `clave`, `pin`, `otp`…), tokens y secretos (`token`, `secret`, `apiKey`), `authorization`, `cookie`, `set-cookie`.
- Variantes y credenciales: `emailAddress`, `mobileNumber`, `idNumber`, `identificacion`, `jwt`, `bearer`, `session`, `sessionId`, `privateKey`, `accessKey`, `secretKey`.
- IP (dato personal): `ip`, `ipAddress`, `remoteAddress`, `x-forwarded-for`, `x-real-ip`.
- Dominio: `hogar`, `household`, `savingsProductId`, `productoAhorro`, `llaveBreb`, `brebKey`, `direccion`, `address` (exactas) e ingresos como sufijo (`ingreso`, `ingresos`, `…income`, por ejemplo `monthlyIncome`). `nombre` no se enmascara.
- Sufijos (`SENSITIVE_KEY_SUFFIXES`): `…password`, `…contrasena`, `…token`, `…secret`, `…apikey`, `…privatekey`, `…authorization`, `…email`, `…correo`, `…phone`, `…telefono`, `…celular`, `…document`, `…documento`, `…cedula`, `…cookie` (por ejemplo `accessToken`, `customerEmail`, `ownerCedula`, `proxy-authorization`).

**Esta lista es una red de seguridad, no la política.** El código solo debe registrar identificadores (`chargeId`, `leaseId`, `userId`), nunca datos personales.

**Límites conocidos:** el enmascarado es por nombre de clave. Un dato personal dentro de un texto libre (el mensaje del log o el mensaje de un error) no se detecta: nunca interpoles datos personales en un mensaje. Solo se comparan sufijos, no prefijos (`contactoCorreo` sí, `correoContacto` no).

### Por qué no basta el `redact` de pino

pino aplica su `redact` nativo también a los loggers hijos, pero solo a rutas exactas: `a.b.email` (profundidad 2) y `list[].email` salen en claro, y no admite sufijos ni comparar sin mayúsculas, acentos o separadores (comprobado con pino 10.4.0). Por eso el enmascarado es propio y se aplica en `formatters.log` y `formatters.bindings`. Como pino no pasa los bindings de los hijos por `formatters.bindings`, `createLogger` sobrescribe `child` para enmascararlos antes de delegar (lo heredan los nietos); una prueba avisa si una actualización de pino lo rompe.

## Desarrollo

```bash
pnpm turbo run lint typecheck test build --filter=@repo/observability
```

El paquete se compila con `tsc` a `dist/` (ADR-0005). Cobertura exigida: 80 % de líneas y 85 % de ramas.
