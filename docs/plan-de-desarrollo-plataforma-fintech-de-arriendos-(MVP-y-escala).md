# Plan de desarrollo — Plataforma fintech de arriendos (MVP y escala)

Nov 11, 2026 · @Kevin

## Resumen ejecutivo

El objetivo es un MVP que corra el ciclo completo de un arriendo (registro, contrato, cobro mensual por Bre-B, conciliación, recibo, score y certificado) con usuarios y proveedores simulados, y que pase a producción cambiando solo configuración y credenciales. La plataforma nunca custodia dinero: orquesta cobros que van directo a la cuenta del dueño y lleva un registro contable propio.

**Decisiones tomadas**

| Tema | Decisión | Por qué |
| --- | --- | --- |
| Monorepo | Turborepo + pnpm, todo en contenedores Docker sobre Linux | Paquetes compartidos (contratos de API, esquemas, dominio) entre backend y frontend |
| Backend | NestJS (TypeScript) | Mismo lenguaje que el frontend, módulos e inyección de dependencias, ecosistema maduro para colas y validación |
| Base de datos | PostgreSQL gestionado con Prisma 7 | Transacciones ACID, restricciones e integridad, necesarias para el ledger |
| Autenticación | Better Auth dentro de NestJS, con correo y Google | Control total de sesiones, auditoría y migración de nube sin dependencia de un proveedor de auth |
| Alcance del MVP | Cobro simulado completo | Prueba la integración de pagos de punta a punta antes de tener credenciales reales |
| Frontend | Next.js con FSD, PWA, mobile-first | Una sola base de código para móvil y escritorio, instalable sin tiendas de apps |
| Equipo | 2 personas, backend primero | La infraestructura y el dominio se estabilizan antes de construir pantallas |

**Qué entrega el MVP**

- Un backend con todos los módulos de negocio, probado con escenarios simulados (pagos exitosos, fallidos, duplicados, tardíos y fraudulentos).
- Un simulador de proveedores con panel de escenarios y reloj controlable para recorrer meses en minutos.
- Una PWA para inquilino y dueño, más una página pública para verificar certificados.
- Un interruptor por variable de entorno para cambiar cada proveedor simulado por el real.

**Fuera del MVP:** dinero real, bolsillos con rendimiento, pólizas, tarjetas y panel de inmobiliarias. Están en la sección de escalamiento.

## Principios de arquitectura fintech

Ocho reglas aplican a todos los módulos; cualquier diseño que viole una se rechaza en revisión de código.

1. **No custodia.** El dinero va de la cuenta del inquilino a la del dueño. La plataforma nunca recibe fondos de terceros en una cuenta propia para reenviarlos.
2. **Ledger de partida doble.** Todo movimiento de valor, aunque sea simulado, genera asientos que suman cero. Los saldos se calculan desde el ledger, nunca se guardan sueltos.
3. **Inmutabilidad.** Pagos, asientos y eventos no se editan ni se borran. Un error se corrige con un asiento de reversa.
4. **Idempotencia en todo.** Cada operación que crea o mueve algo recibe una clave de idempotencia. Repetir una petición o un webhook produce el mismo resultado, no uno nuevo.
5. **Nunca confiar en un webhook.** Un aviso del proveedor dispara una consulta a su API; solo el resultado de esa consulta cambia estados.
6. **Proveedores intercambiables.** Cada servicio externo (pagos, identidad, notificaciones, almacenamiento) se usa a través de una interfaz con dos implementaciones: simulada y real.
7. **Reloj controlable.** Ninguna lógica lee la hora del sistema directamente; todo pasa por un servicio de reloj que el simulador puede adelantar.
8. **Auditoría completa.** Cada acción de usuario, de sistema o de proveedor deja un registro con quién, qué, cuándo y desde dónde.

Dinero siempre en **centavos y enteros** (`bigint`), nunca en decimales de punto flotante. Las fechas se guardan en UTC y se muestran en hora de Colombia (America/Bogota).

## Arquitectura del monorepo

Un solo repositorio con Turborepo y pnpm: cuatro aplicaciones desplegables y nueve paquetes compartidos, con reglas de dependencia que se validan en CI.

```
repo/
├─ apps/
│  ├─ api/            NestJS · API HTTP, auth, webhooks
│  ├─ worker/         NestJS (standalone) · colas y tareas programadas
│  ├─ provider-sim/   NestJS · simulador de Payments Way, KYC y notificaciones
│  └─ web/            Next.js · PWA inquilino, dueño, verificación pública (fase 2)
├─ packages/
│  ├─ domain/         lógica pura: Money, contratos, cobros, score, reglas del ledger
│  ├─ contracts/      esquemas zod de la API + generación de OpenAPI
│  ├─ api-client/     cliente tipado para el frontend, generado desde contracts
│  ├─ db/             esquema Prisma, migraciones, seeds
│  ├─ integrations/   interfaces de proveedores + adaptadores mock y reales
│  ├─ observability/  logger, trazas y métricas compartidas
│  ├─ testing/        fábricas de datos, escenarios y utilidades de prueba
│  ├─ ui/             design system (Radix + Tailwind) (fase 2)
│  └─ config/         tsconfig, ESLint, Prettier compartidos
├─ infra/
│  └─ docker/         compose.yaml, perfiles y configuración de servicios locales
├─ turbo.json
└─ pnpm-workspace.yaml
```

&#91;embedded content: arquitectura · 4 apps, 4 paquetes clave, Postgres y Redis\]

La web y el simulador solo se comunican con la API por HTTP; `api` y `worker` comparten la lógica de `packages` y se coordinan por colas en Redis.

**Reglas de dependencia**

| Paquete o app | Puede importar | Nunca importa |
| --- | --- | --- |
| `domain` | Nada externo (solo TypeScript) | NestJS, Drizzle, HTTP, proveedores |
| `contracts` | `zod` | `domain` interno, `db` |
| `db` | `@prisma/client`, `domain` (tipos) | `integrations`, apps |
| `integrations` | `domain`, `contracts` | `db`, apps |
| `api`, `worker` | todos los paquetes de backend | `web`, `ui` |
| `provider-sim` | `contracts`, `integrations` (formas de payload) | `db` de la plataforma (tiene su propia base) |
| `web` | `contracts`, `api-client`, `ui`, utilidades puras de `domain` | `db`, `integrations` |

Las reglas se hacen cumplir con `eslint-plugin-boundaries` o `dependency-cruiser` en CI: un import prohibido rompe el build.

**Capas dentro de cada módulo de NestJS** (arquitectura hexagonal):

- `domain/`: entidades y reglas del módulo, sin dependencias.
- `application/`: casos de uso (`CreateLease`, `ReserveCharge`), transacciones y orquestación.
- `infrastructure/`: repositorios con Prisma, adaptadores de proveedores, colas.
- `interface/`: controladores HTTP, receptores de webhooks y consumidores de colas.

**Herramientas base:** pnpm, Turborepo con caché remota, TypeScript estricto, Node.js LTS, Docker y Docker Compose sobre Linux (ver la sección de contenedores).

**ORM:** Prisma 7. Desde la versión 7 el cliente se genera sin binario de Rust (compilador de consultas en TypeScript con el adaptador de pg), lo que simplifica las imágenes Docker. Migraciones con prisma migrate; lo que Prisma no expresa (triggers del ledger, permisos de solo inserción, índices parciales) va como SQL dentro de las mismas migraciones. Transacciones interactivas para el ledger y BigInt para el dinero.

## Contenedores y entorno Linux

Sí es posible y es lo recomendado: todo el sistema corre en contenedores Linux, del desarrollo local a producción, con la misma imagen promovida de un ambiente al siguiente. En Linux se usa Docker Engine directamente; en macOS y Windows (con WSL2) se usa Docker Desktop, y los contenedores siguen siendo Linux.

### Imágenes por aplicación

Cada app tiene su `Dockerfile` en `apps/<app>/Dockerfile`, construido en tres etapas:

1. **Poda:** `turbo prune <app> --docker` copia solo el código y las dependencias que esa app usa del monorepo.
2. **Construcción:** instala dependencias con `pnpm install --frozen-lockfile`, ejecuta `prisma generate` y compila TypeScript.
3. **Ejecución:** imagen mínima con Node.js LTS sobre Debian slim, usuario sin privilegios, `HEALTHCHECK` y solo los archivos compilados.

Se prefiere Debian slim a Alpine: evita incompatibilidades con librerías nativas (fuentes para PDF, criptografía). Como Prisma 7 ya no usa binario de Rust, no hay que configurar destinos de binario por sistema operativo.

| Imagen | Contenido | Notas |
| --- | --- | --- |
| `api` | NestJS HTTP | Puerto 3000, healthcheck en `/health` |
| `worker` | NestJS standalone con BullMQ | Sin puerto público; varias réplicas posibles |
| `provider-sim` | Simulador de proveedores | Nunca se publica en el registro de producción |
| `migrator` | CLI de Prisma | Ejecuta `prisma migrate deploy` como tarea única antes de cada despliegue, nunca al arrancar la API |
| `web` | Next.js con salida `standalone` | Para portabilidad; en Vercel no se necesita la imagen |

### Entorno local con Docker Compose

Un archivo `infra/docker/compose.yaml` levanta todo con un comando. Los servicios tienen healthchecks y cada app espera a que sus dependencias estén sanas.

| Servicio | Imagen | Para qué |
| --- | --- | --- |
| `postgres` | PostgreSQL oficial | Base de la plataforma y base separada del simulador |
| `redis` | Redis oficial | Colas y reloj simulado |
| `minio` | MinIO | Almacenamiento compatible con S3 para PDFs y comprobantes |
| `mailpit` | Mailpit | Bandeja de correo falsa con interfaz web |
| `api`, `worker`, `provider-sim` | Imágenes propias | Con recarga automática mediante `docker compose watch` |
| `web` | Imagen propia | Se agrega en la fase 4 |

Perfiles de Compose para no levantar todo siempre: `infra` (solo Postgres, Redis, MinIO y Mailpit), `backend` (infra más `api`, `worker` y `provider-sim`) y `full`.

Opcional: un Dev Container (VS Code o JetBrains) con Node, pnpm y las herramientas fijadas, para que ambas personas trabajen con el mismo entorno exacto.

### CI y producción

- Las pruebas de integración usan Testcontainers, que crea Postgres y Redis desechables por suite; el runner de CI necesita Docker.
- En cada fusión a `main` se construyen las imágenes con caché de capas, se escanean con Trivy y se publican en un registro (GitHub Container Registry o Amazon ECR) etiquetadas con el hash del commit.
- La misma imagen pasa de `staging` a `production`; solo cambian variables de entorno y secretos, que nunca se copian dentro de la imagen.
- Destino de las imágenes: Railway o Render en staging (aceptan Dockerfile) y AWS ECS Fargate en producción.

## Backend NestJS: módulos

El backend se divide en 15 módulos de negocio y 4 transversales; cada uno tiene dueño, límites claros y se comunica con los demás por casos de uso o eventos, nunca leyendo tablas ajenas.

### Módulos de negocio

| # | Módulo | Responsabilidad | Endpoints y eventos clave |
| --- | --- | --- | --- |
| 1 | `auth` | Registro e inicio de sesión con correo o Google, sesiones, recuperación de cuenta, segundo factor para acciones sensibles | Rutas de Better Auth en `/v1/auth/*` (correo, Google, sesión, 2FA); evento `UserRegistered` |
| 2 | `users` | Perfil, roles (inquilino, dueño, admin, operaciones), preferencias | `GET/PATCH /me` |
| 3 | `consents` | Autorizaciones de tratamiento de datos con versión del texto, fecha, IP y canal; revocación | `POST /consents`, `DELETE /consents/:id`; evento `ConsentRevoked` |
| 4 | `identity` | Verificación de identidad (documento, biometría, listas restrictivas) a través de `IdentityProvider` | `POST /identity/verifications`; webhook del proveedor; evento `IdentityVerified` |
| 5 | `properties` | Inmuebles: dirección, ciudad, tipo, estrato; un dueño puede tener varios | CRUD `/properties` |
| 6 | `leases` | Contrato: partes, canon, día de pago, fecha de inicio y fin, reajuste anual por IPC con su tope; invitación al dueño | `POST /leases`, `POST /leases/:id/invite-owner`, `POST /leases/:id/accept`; eventos `LeaseActivated`, `LeaseEnded` |
| 7 | `payout-destinations` | Llave Bre-B o cuenta del dueño, verificación de titularidad antes de usarla | `POST /payout-destinations`, `POST /:id/verify` |
| 8 | `charges` | Un cobro por periodo: generación, reserva de llave dinámica, expiración, renovación, estados | `GET /leases/:id/charges`, `POST /charges/:id/payment-intent`; eventos `ChargeCreated`, `ChargePaid`, `ChargeOverdue` |
| 9 | `provider-events` | Recepción de webhooks, deduplicación, verificación contra la API del proveedor, conciliación diaria | `POST /webhooks/paymentsway`; tarea `reconcile-daily` |
| 10 | `ledger` | Cuentas internas, asientos de partida doble, saldos, reversas | Solo interno; consulta `GET /admin/ledger/accounts/:id` |
| 11 | `receipts` | Recibo por cobro pagado: numeración consecutiva, PDF, hash, almacenamiento | `GET /receipts/:id`, `/receipts/:id/pdf`; evento `ReceiptIssued` |
| 12 | `score` | Eventos que mueven el puntaje, cálculo explicable y versionado de la fórmula | `GET /me/score`, `/me/score/history`; evento `ScoreChanged` |
| 13 | `certificates` | Emisión, firma digital, expiración, revocación y página pública de verificación | `POST /certificates`, `GET /public/certificates/:code` |
| 14 | `notifications` | Recordatorios y avisos por correo, push y WhatsApp con plantillas y preferencias | Solo interno; consumidor de eventos |
| 15 | `backoffice` | Operaciones: buscar usuarios y cobros, reintentar, conciliar a mano con doble aprobación | `/admin/*` con rol y segundo factor |

### Módulos transversales

| Módulo | Qué resuelve |
| --- | --- |
| `audit` | Registro inmutable de toda acción: actor, acción, recurso, antes y después, IP, `request_id` |
| `outbox` | Los eventos de dominio se guardan en la misma transacción que el cambio y el worker los publica a la cola; así nunca se pierde un evento ni se publica uno de una transacción fallida |
| `idempotency` | Interceptor que exige `Idempotency-Key` en los `POST` que crean o mueven algo y guarda la respuesta para devolverla igual si se repite |
| `clock` | Servicio de hora inyectable; en simulación lo controla el panel |

### Colas y tareas programadas (worker)

Cola con BullMQ sobre Redis. Cada tarea es idempotente y reintenta con espera exponencial.

| Tarea | Cuándo | Qué hace |
| --- | --- | --- |
| `generate-charges` | Diario, 00:05 hora Colombia | Crea los cobros del periodo que vencen en los próximos 5 días |
| `reserve-dynamic-key` | Al crear un cobro y al expirar una llave | Pide una llave nueva al proveedor |
| `mark-overdue` | Diario | Marca cobros vencidos y emite `ChargeOverdue` |
| `poll-pending` | Cada 10 minutos | Consulta cobros pendientes sin webhook (por si el aviso nunca llega) |
| `reconcile-daily` | Diario | Compara las transacciones del proveedor con el ledger y abre incidencias si no cuadran |
| `render-receipt` | Al pagarse un cobro | Genera el PDF y lo guarda |
| `recompute-score` | Al pagarse o vencerse un cobro | Recalcula y guarda el nuevo puntaje con su explicación |
| `send-notification` | Por evento | Envía por el canal que corresponda |

### Convenciones de la API

- REST versionado (`/v1`), JSON, documentado con OpenAPI generado desde `packages/contracts`.
- Validación con esquemas zod compartidos (`nestjs-zod`), los mismos que usa el frontend en sus formularios.
- Errores con formato único (`code`, `message`, `details`, `request_id`), basado en RFC 9457.
- Paginación por cursor, nunca por página numerada, en listas que crecen (cobros, movimientos, auditoría).

## Modelo de datos, estados y ledger

PostgreSQL con identificadores UUIDv7 (ordenables por tiempo), dinero en `bigint` de centavos y restricciones en la base, no solo en el código.

### Tablas principales

| Grupo | Tablas | Notas |
| --- | --- | --- |
| Identidad | `users`, `sessions`, `consents`, `identity_verifications` | Documento y datos sensibles cifrados a nivel de columna |
| Contratos | `properties`, `leases`, `lease_parties`, `lease_adjustments`, `payout_destinations` | `lease_adjustments` guarda cada reajuste por IPC con su fecha |
| Cobros | `charges`, `charge_attempts`, `provider_transactions` | Un `charge` por periodo; cada llave reservada es un `charge_attempt` |
| Eventos externos | `provider_events` | Webhook crudo, `UNIQUE (provider, external_id, status)` para deduplicar |
| Ledger | `ledger_accounts`, `ledger_transactions`, `ledger_entries` | Partida doble, solo inserción |
| Documentos | `receipts`, `certificates`, `files` | Hash SHA-256 de cada PDF |
| Score | `score_events`, `score_snapshots`, `score_formulas` | La fórmula tiene versión; cada snapshot guarda con cuál se calculó |
| Plataforma | `outbox`, `idempotency_keys`, `audit_log`, `jobs_dead_letter` | `audit_log` sin `UPDATE` ni `DELETE` (permisos de base de datos) |

### Estados de un cobro

| Desde | Hacia | Disparador |
| --- | --- | --- |
| — | `scheduled` | La tarea `generate-charges` crea el cobro del periodo |
| `scheduled` | `awaiting_payment` | Se reserva la llave dinámica y se notifica al inquilino |
| `awaiting_payment` | `awaiting_payment` | La llave expira y se reserva una nueva (nuevo `charge_attempt`) |
| `awaiting_payment` | `paid` | El proveedor confirma por consulta que la transacción es exitosa |
| `awaiting_payment` | `overdue` | Pasa la fecha de pago sin confirmación |
| `overdue` | `paid_late` | Se confirma un pago después del vencimiento |
| `paid` / `paid_late` | `reversed` | El proveedor reporta reembolso o reversa; se crea asiento de reversa |
| cualquiera abierto | `cancelled` | El contrato termina o el dueño anula el periodo, con motivo |

La máquina de estados vive en `packages/domain` y rechaza transiciones inválidas (por ejemplo, de `paid` a `awaiting_payment` si llega un webhook tardío).

### Ledger de partida doble

En el MVP no hay dinero propio en custodia, así que el ledger registra **obligaciones y su cumplimiento**, no saldos bancarios.

| Cuenta | Tipo | Qué representa |
| --- | --- | --- |
| `lease:{id}:receivable` | Activo del dueño | Lo que el inquilino debe al dueño |
| `lease:{id}:rent_income` | Ingreso del dueño | Canon devengado |
| `owner:{id}:settled_external` | Activo del dueño | Pagos confirmados que llegaron a su banco |
| `platform:fees` | Ingreso de la plataforma | Comisiones propias, si las hay (fase posterior) |

Ejemplo, canon de $1.500.000 del periodo 2026-12:

| Momento | Débito | Crédito | Valor (centavos) |
| --- | --- | --- | --- |
| Se crea el cobro | `lease:L1:receivable` | `lease:L1:rent_income` | 150000000 |
| Se confirma el pago | `owner:O1:settled_external` | `lease:L1:receivable` | 150000000 |

- Cada `ledger_transaction` suma cero; un trigger diferido en Postgres lo verifica al confirmar la transacción; se crea con SQL dentro de una migración de Prisma.
- Los saldos se calculan con una vista materializada o una consulta agregada, nunca con un campo `balance` que se actualiza.
- Este diseño sirve sin cambios cuando llegue la fase de bolsillos (BaaS): se agregan cuentas `wallet:{id}` y `yield:{id}`.

## Integraciones externas: análisis y selección

No se elige proveedor de pagos para producción todavía: el MVP simula la API de Payments Way (la que mejor encaja con el cobro por periodo) y la decisión final se toma en la fase 4 con la matriz de criterios de abajo.

### Pagos y Bre-B

| Proveedor | Qué ofrece para este caso | Sandbox | Webhooks | Encaje |
| --- | --- | --- | --- | --- |
| [Payments Way](https://developer.paymentsway.co/docs/merchant/integracion-breb/llave-dinamica) | Llave dinámica Bre-B ligada a monto exacto con conciliación automática; QR estático y dinámico; PayOuts; billetera marca blanca con KYC | Se entrega al activar el servicio | Sin firma documentada; hay que confirmar consultando la API | Alto para el cobro por periodo; dudas sobre el modelo de fondos (agregador) |
| [Wompi](https://docs.wompi.co/en/docs/colombia/sandbox-breb/) (Grupo Cibest) | Pasarela, links y QR; resolución de llaves Bre-B (ver el titular enmascarado antes de pagar); dispersión por Bre-B | Autoservicio, con llaves de prueba y estados controlables | [Firmados con checksum](https://docs.wompi.co/en/docs/colombia/guia-integracion-breb/) | Alto para verificar la llave del dueño; revisar si concilia cobros por referencia |
| [Cobre](https://apis.io/providers/cobre/) | API empresarial: cuentas, contrapartes, llaves Bre-B, conciliación, pagos inmediatos | Sí | Firmados | Medio: orientado a empresas, venta consultiva |
| [Kushki](https://docs.kushki.com/es/co/apm/bre-b-payments) | QR Bre-B (beta, procesador Credibanco), dispersión Bre-B (beta), onboarding de subcomercios por API | Sí | Sí | Medio: útil si cada dueño debe ser subcomercio |
| [EBANX](https://docs.ebanx.com/docs/pay-in/processing/payment-methods/country-specific/colombia/breb) | QR Bre-B por API | Sí | Sí | Bajo: enfoque transfronterizo |
| [Bold](https://developers.bold.co/api-integrations/integration-sandbox) | API ligada a datáfono SmartPro | Requiere datáfono | — | Bajo: pensado para venta presencial |

**Criterios para elegir el de producción (fase 4):**

1. **Modelo de fondos:** el dinero debe llegar directo al dueño (subcomercio o llave propia), no a una cuenta de la plataforma.
2. **Conciliación por cobro:** una referencia o llave única por periodo que identifique el pago sin intervención manual.
3. **Webhooks firmados** y API de consulta de estado.
4. **Sandbox completo** con estados controlables.
5. **Precio por transacción Bre-B** y costo fijo mensual, cotizados por escrito.
6. **Respaldo regulatorio:** qué entidad vigilada está detrás de cada producto.

Precio público de referencia: Payments Way cobra 3 % + $800 + IVA en tarjeta y PSE ([tarifas](https://www.paymentsway.co/soluciones/pasarela-de-pago#tarifas)); Wompi anunció 1 % + IVA en pagos con QR ([Cambio](https://cambiocolombia.com/peso-a-peso-paso-a-paso/articulo/2026/9/wompi-amplia-los-pagos-sin-contacto-y-baja-al-uno-por-ciento-la-tarifa-de-los-pagos-con-qr)). Bre-B por llave dinámica hay que cotizarlo.

### Verificación de identidad (KYC)

| Proveedor | Fortaleza | Precio | Uso propuesto |
| --- | --- | --- | --- |
| [Truora](https://www.truora.com/truchecks?hsLang=en) | Colombiana, consulta bases oficiales y listas, validación por WhatsApp | A cotizar | Candidato principal para producción |
| [Didit](https://didit.me/es/blog/comparison-didit-vs-truora-the-top-kyc-alternatives-es/) | API pública, webhooks con HMAC, 500 verificaciones gratis al mes según el proveedor | US$0,30 por verificación (dato del propio proveedor) | Sandbox de desarrollo real en fase 4 |
| KYC de Payments Way | Incluido en su billetera (biometría y listas restrictivas) | Con la billetera | Solo si se usa su billetera en la fase BaaS |

Las comparaciones de Didit vienen de su propio sitio; hay que validarlas con una prueba antes de decidir.

### Resto de la infraestructura

| Necesidad | MVP | Producción | Alternativa |
| --- | --- | --- | --- |
| Base de datos | Postgres en Docker local; Neon o Supabase (solo base) en staging | AWS RDS Postgres o Neon con plan pago | Supabase Postgres |
| Cola y caché | Redis en Docker; Upstash en staging | Redis gestionado (ElastiCache o Upstash) | — |
| Autenticación | Better Auth (TypeScript, adaptador Prisma, 2FA, Google) dentro de NestJS | Igual | Implementación propia con argon2 + JWT (`jose`) |
| Hosting API y worker | Railway o Render | AWS ECS Fargate | Fly.io |
| Hosting web | Vercel | Vercel | AWS Amplify |
| Archivos (PDF, comprobantes) | MinIO local | Cloudflare R2 o AWS S3 con URLs firmadas | — |
| Correo | Mailpit local (bandeja falsa) | Resend o AWS SES | Postmark |
| WhatsApp | Simulador | Meta WhatsApp Cloud API directa o un BSP | Twilio |
| Push | Web Push con VAPID | Igual | OneSignal |
| Errores | Sentry | Sentry | — |
| Logs, trazas, métricas | pino + OpenTelemetry a consola | OpenTelemetry a Grafana Cloud o Better Stack | Datadog |
| Secretos | `.env` local cifrado | Doppler o AWS Secrets Manager | Infisical |
| PDF | `@react-pdf/renderer` en el worker | Igual | Playwright HTML a PDF |
| Firma de certificados | Ed25519 con `node:crypto`, llave en archivo | Llave en AWS KMS | — |

Los precios de esta tabla no se verificaron; se cotizan antes de la fase 4. Dónde se alojan los datos (Colombia o exterior) es una decisión para el abogado por las reglas de transferencia internacional de datos personales.

## Capa de simulación

El simulador es una aplicación aparte (`apps/provider-sim`) con su propia base de datos que imita a los proveedores reales byte a byte; la plataforma no sabe si habla con él o con el proveedor de verdad.

### Qué simula

| Proveedor simulado | Comportamiento | Formas que imita |
| --- | --- | --- |
| Payments Way · llave dinámica | Reserva llave por monto, expira, acepta solo el monto exacto, notifica | `transaction_id`, `key.value`, `expires_at`, webhook con `idstatus.id` (34 exitosa, 36 fallida…), JWT de 1 hora |
| Payments Way · consulta | Devuelve el estado real de la transacción en el simulador | "Obtener transacción" |
| Resolución de llaves Bre-B | Devuelve titular enmascarado o error de llave inexistente | Formas de la API de Wompi para dejar abierta esa opción |
| KYC | Aprueba, rechaza o pide revisión según el número de documento de prueba | Genérico, mapeado por el adaptador |
| Notificaciones | Guarda cada mensaje en una bandeja visible en el panel | WhatsApp, correo y push |

### Panel de escenarios

Una página interna (`/sim`) con botones que disparan cada caso sobre un cobro elegido:

- [ ] Pago exitoso por el monto exacto
- [ ] Pago por monto distinto (rechazado)
- [ ] Llave expirada antes del pago
- [ ] Webhook duplicado (mismo aviso dos o tres veces)
- [ ] Webhooks fuera de orden (pendiente llega después de exitosa)
- [ ] Webhook que nunca llega (la tarea `poll-pending` debe encontrarlo)
- [ ] Webhook falso con un estado que la consulta contradice
- [ ] Proveedor caído (respuestas 503 y tiempos de espera)
- [ ] Reembolso después de un pago confirmado
- [ ] Pago tardío después del vencimiento

Un escenario solo se da por cumplido cuando tiene una prueba automática que lo reproduce.

### Reloj controlable

- `ClockService` es la única fuente de hora en `api` y `worker`. En simulación lee un valor guardado en Redis.
- El panel permite avanzar 1 día, 1 semana o 1 mes; al avanzar, el worker ejecuta las tareas programadas que hubieran corrido en ese lapso, en orden.
- Con esto se recorre un año de contratos en minutos y se prueba el reajuste anual por IPC, los atrasos y la evolución del score.

### Datos sintéticos

Un comando `pnpm seed:scenario <nombre>` crea personajes con historias predefinidas:

| Escenario | Personajes | Qué prueba |
| --- | --- | --- |
| `puntual` | Inquilina que paga siempre el día 3 | Score ascendente y certificado |
| `atrasos` | Inquilino que paga tarde 1 de cada 3 meses | Penalización y recuperación del score |
| `impago` | Inquilino que deja de pagar en el mes 4 | Estados vencidos y alertas al dueño |
| `multi-contrato` | Dueño con 3 inmuebles | Panel del dueño y conciliación |
| `reajuste` | Contrato que cumple un año | Reajuste por IPC con tope legal |

Ninguna base de prueba contiene datos personales reales: cédulas y teléfonos se generan con prefijos reservados para pruebas.

### Interruptor hacia producción

Cada proveedor se elige con su propia variable de entorno (`PAYMENTS_PROVIDER=mock|paymentsway|wompi`, `KYC_PROVIDER=mock|truora|didit`, etc.). El arranque del `api` falla si en producción alguna variable sigue en `mock`, y el módulo del simulador ni siquiera se carga en ese ambiente.

## Autenticación: Better Auth con Google

La decisión es Better Auth dentro de NestJS, con correo y contraseña, ingreso con Google y segundo factor. Da el mismo control que una auth propia (corre en nuestro proceso y guarda todo en nuestra base) sin escribir desde cero la parte criptográfica, que es donde una implementación casera suele fallar.

### Comparación

| Criterio | Better Auth (elegida) | Supabase Auth | Implementación propia |
| --- | --- | --- | --- |
| Dónde viven usuarios y sesiones | Tablas propias en nuestro Postgres, vía adaptador de Prisma | Esquema `auth` gestionado por Supabase | Tablas propias |
| Google y otros proveedores | Configuración (`socialProviders`) | Configuración en el panel | Implementar OAuth/OIDC a mano |
| Segundo factor | Plugin (TOTP, OTP, códigos de respaldo) | TOTP incluido; MFA avanzada como complemento pago | Construirlo |
| Auditoría | Hooks de endpoint y de base de datos escriben en nuestro `audit_log`, en la misma transacción | Tiene registro de auditoría propio; formato y retención los define Supabase | Total |
| Escalabilidad | Escala con nuestra API; sesiones en Postgres y caché en Redis; sin límite por usuarios | Probada a gran escala; 50.000 usuarios activos al mes gratis y luego pago por usuario activo | Depende de nosotros |
| Costo | Libre (código abierto); solo nuestra infraestructura | Por usuarios activos mensuales | Semanas de desarrollo y revisión de seguridad |
| Dependencia de proveedor | Baja | Media-alta: usuarios y tokens viven en Supabase | Ninguna |

**¿Supabase Auth es suficientemente escalable?** Sí: técnicamente aguanta este proyecto de sobra, y un análisis independiente lo ubica en unos US$100 al mes con 100.000 usuarios activos ([fuente](https://guptadeepak.com/ciam-compass/vendors/supabase-auth/)). No se elige por otras razones: los usuarios quedan fuera de nuestro esquema, la auditoría queda partida en dos sistemas y migrar después implica mover usuarios y tokens. Supabase sigue siendo válido como proveedor de Postgres gestionado, sin usar su Auth.

**¿Cuándo sí haría falta una implementación propia?** Solo si un requisito regulatorio o de un banco aliado no se puede cumplir con Better Auth. Como Better Auth guarda todo en nuestras tablas, ese cambio sería posible sin migrar usuarios.

### Diseño

- Better Auth se monta en NestJS bajo `/v1/auth/*`. Su configuración se divide en dos archivos: uno mínimo para generar el esquema de Prisma y otro con inyección de dependencias para correo y auditoría.
- Better Auth resuelve identidad y sesión; los roles y permisos (inquilino, dueño, operaciones, por contrato) siguen en nuestro módulo `users` y en guards de NestJS.
- Sesiones en Postgres con cookie `httpOnly` en el dominio raíz; Redis como almacenamiento secundario para sesiones y límite de peticiones.
- La web usa el cliente de Better Auth para React (botón de Google, sesión, 2FA). Para una futura app nativa se agrega el plugin de tokens Bearer.

### Ingreso con Google: reglas

- Google solo prueba que la persona controla ese correo, no su identidad: la verificación de identidad (KYC) sigue siendo obligatoria antes de crear contratos.
- Solo se piden los alcances `openid`, `email` y `profile`.
- Una cuenta de Google se vincula a una cuenta existente solo si el correo está verificado por ambos lados.
- Aunque se entre con Google, el segundo factor sigue siendo obligatorio para acciones sensibles (cambiar la llave del dueño, emitir certificados, backoffice).

### Auditoría de autenticación

Cada uno de estos eventos queda en `audit_log` con usuario, IP, agente de navegador y resultado: registro, inicio de sesión exitoso y fallido, ingreso con Google, vinculación de cuentas, cierre de sesión, activación y uso del segundo factor, cambio y recuperación de contraseña, y revocación de sesiones. Se implementa con los hooks `before` y `after` de los endpoints y los hooks de base de datos de Better Auth ([guía](https://supercode.sh/en/skills/better-auth/skills/better-auth-best-practices)), y cada evento tiene su prueba.

## Seguridad, datos y observabilidad

La seguridad se construye desde la fase 1, no al final: los controles de esta sección son criterios de aceptación de cada módulo.

### Autenticación y acceso

- Ingreso con correo y contraseña o con Google mediante Better Auth; sesiones guardadas en Postgres y enviadas en cookie `httpOnly`, `Secure`, `SameSite=Lax`.
- Segundo factor (OTP) obligatorio para cambiar la llave o cuenta del dueño, emitir certificados y todo el `backoffice`.
- Autorización por rol y por recurso: un inquilino solo ve sus contratos; un dueño, los de sus inmuebles. Se prueba con casos específicos de acceso indebido.
- Límite de peticiones por IP y por usuario en login, OTP y endpoints públicos (verificación de certificados).

### Protección de datos personales

- Cifrado de columnas sensibles (documento, teléfono, datos de la llave del dueño) con cifrado de sobre: llave de datos por registro, llave maestra en KMS en producción.
- Minimización: solo se guarda lo que un caso de uso necesita; los comprobantes y selfies de KYC quedan en el proveedor cuando sea posible.
- Registro de autorizaciones (`consents`) con versión del texto; revocar una autorización detiene el tratamiento correspondiente.
- Política de retención y borrado por tipo de dato, definida con el abogado.
- Logs sin datos personales: un filtro de pino enmascara documento, correo, teléfono y tokens.

### Integridad financiera

- Firma Ed25519 de recibos y certificados; la página pública verifica la firma y el estado (vigente, expirado, revocado).
- Webhooks: endpoint con HTTPS, lista de IP del proveedor si la publica, deduplicación y confirmación por consulta.
- Acciones manuales del `backoffice` sobre dinero o estados requieren doble aprobación (cuatro ojos) y quedan en auditoría.
- Conciliación diaria automática entre transacciones del proveedor y ledger; cualquier diferencia abre una incidencia.

### Seguridad de la cadena de suministro

- Dependencias fijadas con `pnpm-lock.yaml`, instalación con `--frozen-lockfile` en CI.
- Renovate para actualizaciones, con espera mínima de algunos días antes de adoptar versiones nuevas.
- Escaneo de dependencias y secretos en cada PR (por ejemplo, `osv-scanner` y `gitleaks`).

### Observabilidad

| Señal | Herramienta | Qué se mide |
| --- | --- | --- |
| Errores | Sentry | Excepciones en `api`, `worker` y `web` con `request_id` |
| Trazas | OpenTelemetry | Petición HTTP → caso de uso → base de datos → proveedor |
| Métricas de negocio | OpenTelemetry + panel | Cobros creados, pagados, vencidos; tiempo de confirmación; webhooks duplicados; diferencias de conciliación |
| Logs | pino en JSON | Con `request_id` y `correlation_id` del cobro |
| Alertas | Sobre las métricas | Diferencia en conciliación, cola con tareas fallidas, tasa de error del proveedor |

### Marco legal a validar con el abogado

Ley 1581 de 2012 (datos personales), Ley 1266 de 2008 (datos de comportamiento de pago, si el score se comparte con terceros), Ley 820 de 2003 (nada que funcione como depósito en garantía) y el contrato con el proveedor de pagos. Ningún usuario real entra al sistema antes de esa validación.

## Frontend Next.js: FSD, PWA y mobile-first

Una sola app Next.js (App Router) sirve móvil y escritorio, se instala como PWA y organiza el código con Feature-Sliced Design; arranca cuando el backend cierra la fase 3.

### Estructura FSD adaptada a App Router

La carpeta `app/` de Next.js solo define rutas y layouts; toda la lógica vive en las capas de FSD dentro de `src/`. La capa `pages` de FSD se llama `views` para no chocar con el Pages Router.

```
apps/web/
├─ app/                      rutas: (tenant)/, (owner)/, verify/[code], admin/, sim/
└─ src/
   ├─ core/                  capa "app" de FSD: providers, estilos globales, config
   ├─ views/                 pantallas completas (TenantHome, LeaseDetail, OwnerCharges)
   ├─ widgets/               bloques grandes (ChargeTimeline, ScoreCard, PayWithBreB)
   ├─ features/              acciones del usuario (register-lease, pay-charge, share-certificate)
   ├─ entities/              modelos de negocio en UI (lease, charge, receipt, score)
   └─ shared/                api-client, ui (de packages/ui), lib, config
```

Regla de FSD: cada capa solo importa de las de abajo (`views` → `widgets` → `features` → `entities` → `shared`). Se hace cumplir con el linter `steiger` o `eslint-plugin-boundaries`.

### Pantallas del MVP

| Área | Pantallas |
| --- | --- |
| Inquilino | Registro y autorización de datos, verificación de identidad, registro del contrato, inicio con próximo cobro, pagar con llave o QR, historial y recibos, score explicado, certificado y compartir |
| Dueño | Aceptar invitación, inmuebles, llave o cuenta de destino con verificación, cobros por contrato, estado de pagos |
| Público | Verificar certificado por código o QR |
| Operaciones | Búsqueda de usuarios y cobros, incidencias de conciliación |
| Simulación | Panel de escenarios, reloj y bandeja de mensajes (solo fuera de producción) |

### Datos, estado y formularios

- Estado del servidor con TanStack Query; cliente tipado generado desde OpenAPI (`openapi-typescript` + `openapi-fetch`, u `orval` si se quieren hooks generados).
- Estado de interfaz mínimo con Zustand (por ejemplo, el paso actual de un flujo); nada de datos de negocio duplicados en el cliente.
- Formularios con react-hook-form y los mismos esquemas zod de `packages/contracts`.
- La sesión vive en cookies `httpOnly` emitidas por la API; nunca tokens en `localStorage`. API y web bajo el mismo dominio raíz (`api.` y `app.`) para que las cookies funcionen.
- Server Components para lecturas iniciales y SEO de la página pública; Client Components solo donde hay interacción.

### PWA

- Service worker con Serwist (sucesor de `next-pwa` para App Router) y manifiesto en `app/manifest.ts`.
- Caché del cascarón de la app y de las últimas lecturas (recibos, score) para consultarlas sin conexión; los pagos y cambios nunca se encolan sin conexión.
- Notificaciones Web Push (VAPID) para recordatorios de pago; en iOS solo funcionan con la app instalada en la pantalla de inicio.
- Pantalla propia de "instalar app" con instrucciones para iOS y Android.

### Mobile-first y escritorio

- Diseño desde 360 px de ancho; navegación inferior en móvil y barra lateral desde `lg` en escritorio.
- Acciones principales al alcance del pulgar; montos en grande con formato `Intl.NumberFormat('es-CO', { currency: 'COP' })`.
- Design system en `packages/ui` con Radix UI y Tailwind, documentado en Storybook; accesibilidad AA (contraste, foco, lectores de pantalla).
- Encabezados de seguridad: CSP estricta, `frame-ancestors 'none'` y sin scripts de terceros en pantallas de pago.

## Pruebas, CI/CD y ambientes

Ningún cambio llega a `main` sin pasar pruebas de dominio, integración con Postgres real y los escenarios del simulador.

### Pirámide de pruebas

| Nivel | Qué cubre | Herramienta | Meta |
| --- | --- | --- | --- |
| Unitarias | `packages/domain`: Money, máquinas de estado, score, reajuste por IPC, reglas del ledger | Vitest | Cobertura de ramas ≥ 90 % en `domain` |
| Basadas en propiedades | Que todo asiento sume cero y que ninguna secuencia de eventos deje un estado inválido | `fast-check` | Casos aleatorios en cada corrida |
| Integración | Casos de uso con Postgres y Redis reales | Vitest + Testcontainers | Cada módulo con su suite |
| Contrato | Que el simulador y el adaptador real respeten las mismas formas | Esquemas zod + colección Postman del proveedor | Se corre al actualizar el adaptador |
| Escenarios | Los 10 casos del panel de simulación, automatizados | Vitest contra `provider-sim` | Todos en verde |
| Extremo a extremo | Registro → contrato → cobro → pago → recibo → certificado, en móvil y escritorio | Playwright | Flujos críticos (fase frontend) |
| Carga | Generación de cobros y ráfagas de webhooks | k6 | Antes de producción |

### Política de pruebas por módulo, archivo y componente

Regla de "terminado": ningún módulo, archivo con lógica o componente se fusiona sin sus pruebas, y CI bloquea el PR si la cobertura del paquete baja del umbral.

| Qué se escribe | Pruebas obligatorias | Herramienta | Umbral |
| --- | --- | --- | --- |
| Entidad, valor o regla en `packages/domain` | Unitarias de cada regla y propiedades invariantes (asientos que suman cero, transiciones válidas) | Vitest + fast-check | 90 % de ramas |
| Caso de uso de NestJS (`application/`) | Unitarias con puertos simulados en memoria + integración con Postgres real | Vitest + Testcontainers | 85 % de líneas por módulo |
| Controlador y DTO | Por endpoint: un caso feliz, uno de validación, uno de acceso indebido | Vitest + Supertest sobre la app NestJS | Todos los endpoints |
| Repositorio con Prisma | Integración con migraciones aplicadas | Testcontainers | Cada consulta propia |
| Adaptador de proveedor | Contrato contra el simulador y contra ejemplos reales del proveedor (incluido el campo `ammount`) | Vitest + esquemas zod | Cada operación del adaptador |
| Tarea del worker | Integración con Redis y reloj controlado; ejecutar dos veces y verificar idempotencia | Vitest + Testcontainers | Cada tarea |
| Hooks de autenticación | Un caso por evento auditado | Vitest + Supertest | Todos los eventos |
| Migración de base de datos | Aplicar desde base vacía y correr seeds | CI | Cada migración |
| Componente de `packages/ui` | Historia en Storybook con prueba de interacción y accesibilidad (axe) | Storybook + Vitest + Testing Library | Cada componente |
| Feature o widget de la web | Comportamiento con la API simulada | Vitest + Testing Library + MSW | 80 % de líneas |
| Hook o utilidad del frontend | Unitarias | Vitest | 90 % de ramas |
| Flujo crítico de usuario | Extremo a extremo en vista móvil y escritorio | Playwright | Flujos de la sección de frontend |

No requieren prueba propia: archivos solo de configuración, tipos, re-exportaciones y módulos de NestJS que solo declaran dependencias.

**Convenciones**

- Un solo ejecutor en todo el monorepo: Vitest. En NestJS se usa con el plugin SWC (`unplugin-swc`) para que funcionen los decoradores.
- Pruebas unitarias junto al archivo (`charge.entity.spec.ts`); integración en `test/integration/*.int-spec.ts`; extremo a extremo en `test/e2e/`.
- Fábricas de datos y escenarios compartidos en `packages/testing`.
- Cada prueba es independiente: la base se limpia o se revierte por transacción; ninguna prueba llama a internet.
- Turborepo ejecuta solo las pruebas de los paquetes afectados en cada PR; la suite completa corre cada noche, con pruebas de mutación (Stryker) sobre `packages/domain`.
- La plantilla de PR incluye la casilla "pruebas agregadas o actualizadas" y el revisor la verifica.

### CI/CD

- GitHub Actions con Turborepo: solo se construye y prueba lo que cambió, con caché remota.
- En cada PR: lint, chequeo de tipos, reglas de dependencia, pruebas, escaneo de secretos y dependencias, migraciones aplicadas a una base vacía.
- Migraciones de base de datos revisadas a mano; nunca destructivas sin un plan de dos pasos (agregar, migrar datos, retirar).
- Despliegue automático a `staging` al fusionar en `main`; a producción con aprobación manual.

### Ambientes

| Ambiente | Proveedores | Datos | Uso |
| --- | --- | --- | --- |
| `local` | Simulador | Sintéticos | Desarrollo diario con Docker Compose |
| `staging` | Simulador | Sintéticos | Demos a aliados, inversionistas y abogado; pruebas extremo a extremo |
| `sandbox` | Sandbox real del proveedor elegido | Sintéticos | Validar el adaptador real (fase 4) |
| `production` | Reales | Reales | Solo después de la validación legal |

Cada ambiente tiene su base de datos, sus secretos y sus llaves de firma; nada se comparte entre ellos.

## Fases y cronograma

Seis fases en unas 24 semanas con dos personas a tiempo completo (con dedicación parcial, multiplicar por 2): el backend completo y probado en la semana 13, la PWA en la 20 y la preparación para producción en la 24. Cada fase termina en una compuerta con criterios verificables; no se pasa a la siguiente sin cumplirlos.

**Roles**

- **Persona A, plataforma e integraciones:** monorepo, CI/CD, infraestructura, auth, simulador, adaptadores de proveedores, observabilidad y seguridad.
- **Persona B, dominio y negocio:** `packages/domain`, contratos, cobros, ledger, score, recibos y certificados. En la fase 4 lidera el frontend.

| Fase | Semanas | Persona A | Persona B | Criterio de salida |
| --- | --- | --- | --- | --- |
| 0. Fundaciones | 1–2 | Monorepo, Turborepo, CI, Docker Compose, NestJS base, Prisma, imágenes Docker, logger, Sentry | Reglas de dependencia, `ClockService`, `outbox`, `idempotency`, `audit`, primer modelo de datos | `pnpm dev` levanta todo; pipeline en verde; una migración aplicada |
| 1. Núcleo de dominio | 3–6 | `auth` con Better Auth, Google y 2FA, `users`, `consents`, límite de peticiones, cifrado de columnas | `domain` (Money, máquina de estados, reglas del ledger, reajuste IPC), `properties`, `leases`, `payout-destinations`, `ledger` | Contratos creados por API con pruebas; pruebas de propiedades del ledger en verde |
| 2. Cobros y simulador | 7–10 | `provider-sim` (llave dinámica, webhooks, consulta, KYC, notificaciones), panel de escenarios, adaptadores mock | `charges`, `provider-events`, tareas del worker, conciliación diaria, `identity` | Los 10 escenarios automatizados en verde; un año simulado sin diferencias de conciliación |
| 3. Documentos y operaciones | 11–13 | `notifications`, `backoffice` con doble aprobación, OpenAPI final y `api-client`, despliegue a `staging` | `receipts` (PDF y hash), `certificates` (firma y verificación), `score` explicable v1 | API v1 congelada y documentada; staging operando con datos sintéticos |
| 4. Frontend PWA | 14–20 | Evaluación de proveedores de pago y KYC, adaptador real en sandbox, pruebas de carga | `packages/ui`, PWA, flujos de inquilino, dueño, página pública y panel de simulación | Flujos extremo a extremo en verde en móvil y escritorio; demo completa en staging |
| 5. Preparación para producción | 21–24 | Endurecimiento, revisión de seguridad externa, alertas, plan de respaldo y recuperación | Textos legales en la app, flujos de consentimiento finales, piloto cerrado en sandbox | Validación legal firmada; proveedor contratado; lista de verificación de la última sección completa |

&#91;embedded content: hoja de ruta · 6 fases y sus compuertas (bandas iguales, no a escala)\]

Cada rombo es una compuerta: la fase siguiente no empieza hasta cumplir el criterio escrito debajo de la fase.

La fase 4 es el primer punto donde ambos trabajan en paralelo en frentes distintos: el backend ya está congelado y la Persona A cambia el foco a proveedores reales.

## Escalamiento después del MVP

Cada etapa de escala se activa por una métrica o un acuerdo comercial, no por calendario; la arquitectura ya deja el lugar listo para cada una.

| Etapa | Se activa cuando | Qué se agrega | Dónde encaja |
| --- | --- | --- | --- |
| Producción con dinero real | Validación legal y proveedor contratado | Adaptador real de pagos y KYC, monitoreo 24/7, soporte | Variables de entorno de proveedores |
| Intermediación de pólizas | Acuerdo con una afianzadora o aseguradora | Módulo `guarantees`: cotización con el score, solicitud, comisión | Nuevo módulo y cuentas `platform:fees` en el ledger |
| Bolsillo del arriendo (BaaS) | Contrato con banco o billetera vigilada | `WalletProvider` y `YieldProvider`, cuentas `wallet:{id}` y `yield:{id}`, pago programado desde el bolsillo | Interfaces de `integrations` y ledger existente |
| Panel para inmobiliarias | 20+ dueños profesionales activos | Organizaciones, agentes, permisos por cartera, carga masiva | Módulos `organizations` y `memberships` |
| Open finance | Acceso como tercero bajo el Decreto 0368 de 2026 | Lectura de ingresos y pagos con consentimiento para el score | Nuevo `FinancialDataProvider` |
| Score con modelos estadísticos | Unos 12 meses de historial real | Servicio Python (FastAPI) aparte, con su propio despliegue; el backend lo consulta por HTTP o colas | Microservicio fuera del monorepo TS o en `services/` |
| App nativa | La PWA limita (por ejemplo, push en iOS o biometría) | Expo con React Native, reutilizando `contracts`, `api-client` y `domain` | Nueva app en `apps/mobile` |

**Escala técnica:**

- **Base de datos:** índices por `lease_id` y `status`; particionar `ledger_entries`, `audit_log` y `provider_events` por mes cuando superen decenas de millones de filas; réplica de lectura para reportes.
- **Worker:** varias instancias consumiendo la misma cola; las tareas ya son idempotentes, así que escalar es agregar réplicas.
- **Separación de servicios:** el monolito modular se mantiene hasta que un módulo tenga carga o equipo propio. Los candidatos naturales a separarse primero son `provider-events` (recepción de webhooks) y `notifications`.
- **Eventos:** si la cola de Redis se queda corta, el `outbox` permite cambiar a un bus de eventos (por ejemplo, SQS o Kafka) sin tocar los módulos.

## Riesgos, decisiones pendientes y lista de verificación

El mayor riesgo no es técnico: es que el modelo de fondos del proveedor obligue a la plataforma a recibir dinero de terceros. Por eso esa pregunta va primero en la lista.

### Riesgos

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| El proveedor solo ofrece modelo agregador (fondos pasan por la plataforma) | Implicaciones legales y tributarias de recaudar para terceros | Exigir subcomercio o llave propia del dueño; si no, cambiar de proveedor |
| La API real difiere del simulador | Retrasos en la fase 4 | Pedir la colección Postman y el sandbox en la fase 2; pruebas de contrato |
| Webhooks sin firma | Pagos falsos marcados como recibidos | Confirmación por consulta siempre; lista de IP si existe |
| El score se considera dato financiero regulado | Obligaciones de la Ley 1266 | Certificado compartido por el propio usuario; validación con el abogado |
| Dos personas para un producto fintech | Cuello de botella y riesgo de persona única | Documentación de decisiones (ADR), revisión cruzada de código, alcance cerrado |
| Costos de proveedores no cotizados | Modelo de negocio sin margen | Cotizaciones por escrito antes de la fase 4 |

### Decisiones pendientes

- [ ] ORM: Prisma 7 — decidido
- [ ] Auth: Better Auth con Google y 2FA — decidido; probar los hooks de auditoría en la semana 1
- [ ] Hosting de staging: Railway o Render — semana 2
- [ ] Nombre del producto y dominio — antes de la fase 3
- [ ] Proveedor de pagos de producción con la matriz de criterios — fase 4
- [ ] Proveedor de KYC de producción — fase 4
- [ ] País de alojamiento de los datos — con el abogado

### Preguntas para Payments Way (y para cada proveedor evaluado)

1. ¿El dinero de la llave dinámica puede llegar directo a la cuenta del dueño (subcomercio) en lugar de a la plataforma?
2. ¿Qué entidad vigilada respalda la billetera y las cuentas?
3. ¿Los webhooks se pueden firmar o tienen IP fijas?
4. ¿Hay sandbox completo de Bre-B con estados controlables, y cuándo lo entregan?
5. ¿Tarifa por transacción con llave dinámica y costo fijo mensual?
6. ¿El campo del monto en el webhook es `amount` o `ammount`?

### Lista de verificación antes de usuarios reales

- [ ] Validación legal firmada (términos, política de datos, autorizaciones, modelo de fondos)
- [ ] Contrato con proveedor de pagos y de KYC
- [ ] Ninguna variable de proveedor en `mock` en producción
- [ ] Llaves de firma y cifrado en KMS; secretos fuera del repositorio
- [ ] Revisión de seguridad externa sin hallazgos críticos abiertos
- [ ] Conciliación diaria y alertas probadas en sandbox
- [ ] Respaldo de base de datos con restauración probada
- [ ] Plan de atención de incidentes y canal de soporte al usuario
- [ ] Piloto cerrado completado con métricas revisadas

### Fuentes

- [Payments Way — documentación para desarrolladores](https://developer.paymentsway.co/)
- [Payments Way — llave dinámica](https://developer.paymentsway.co/docs/merchant/integracion-breb/llave-dinamica)
- [Payments Way — webhook](https://developer.paymentsway.co/docs/merchant/webhook/notificaciones)
- [Wompi — sandbox Bre-B](https://docs.wompi.co/en/docs/colombia/sandbox-breb/)
- [Wompi — guía de integración Bre-B](https://docs.wompi.co/en/docs/colombia/guia-integracion-breb/)
- [Kushki — pagos con Bre-B](https://docs.kushki.com/es/co/apm/bre-b-payments)
- [EBANX — Bre-B](https://docs.ebanx.com/docs/pay-in/processing/payment-methods/country-specific/colombia/breb)
- [Bold — ambiente de pruebas](https://developers.bold.co/api-integrations/integration-sandbox)
- [Cobre en APIs.io](https://apis.io/providers/cobre/)
- [Truora — TruChecks](https://www.truora.com/truchecks?hsLang=en)
- [Didit vs. Truora (fuente del proveedor)](https://didit.me/es/blog/comparison-didit-vs-truora-the-top-kyc-alternatives-es/)

* [Supabase — Auth](https://supabase.com/docs/guides/auth)
* [Supabase — Auth de terceros](https://supabase.com/docs/guides/auth/third-party/overview.md)
* [Supabase Auth: precios y capacidades (análisis independiente)](https://guptadeepak.com/ciam-compass/vendors/supabase-auth/)
* [Better Auth — guía de buenas prácticas](https://supercode.sh/en/skills/better-auth/skills/better-auth-best-practices)
* [Prisma 7 — cambios de arquitectura](https://www.prisma.io/blog/prisma-7-ama-clearing-up-the-why-behind-the-changes)
* [Prisma — controladores y adaptadores](https://www.prisma.io/docs/v6/orm/overview/databases/database-drivers)
