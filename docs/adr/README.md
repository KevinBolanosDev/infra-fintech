# Registro de decisiones de arquitectura (ADR)

Cada decisión de arquitectura aceptada deja un ADR corto en esta carpeta (lo pide `CLAUDE.md`).

## Convenciones

- Archivo: `NNNN-titulo-en-kebab-case.md`, numeración correlativa de cuatro dígitos. Se parte de `0000-plantilla.md`.
- Estados: **Propuesto** (borrador, pendiente de aprobación del usuario) · **Aceptado** · **Reemplazado por ADR-NNNN** · **Descartado**.
- Un ADR aceptado no se reescribe: si la decisión cambia, se crea uno nuevo que lo reemplaza y el viejo solo cambia su estado.
- Idioma: español. Versiones de dependencias siempre exactas y verificadas contra el registro de npm en la fecha indicada.

## Índice

| ADR | Título | Estado | Fecha |
| --- | --- | --- | --- |
| [0000](0000-plantilla.md) | Plantilla | — | — |
| [0001](0001-toolchain-y-versiones.md) | Toolchain y versiones | Aceptado | 2026-11-12 |
| [0002](0002-herramienta-de-fronteras.md) | Herramienta que hace cumplir las reglas de dependencia | Aceptado | 2026-11-13 |
| [0003](0003-capas-y-ubicacion-de-modulos.md) | Capas confirmadas y ubicación de los módulos compartidos | Aceptado | 2026-11-13 |
| [0004](0004-infraestructura-local.md) | Infraestructura local (Docker Compose) y almacenamiento S3 diferido | Aceptado | 2026-11-18 |
| [0005](0005-paquetes-internos-compilados.md) | Paquetes internos compilados con `tsc` y condición `source` | Aceptado | 2026-11-18 |
| [0006](0006-hora-de-los-logs.md) | Excepción de reloj para la hora de los logs y regla de ESLint | Aceptado | 2026-11-18 |
| [0007](0007-compilacion-y-recarga-de-apps.md) | Compilación y recarga de las apps NestJS: `tsc` + `node --watch` | Aceptado | 2026-11-18 |
| [0008](0008-contrato-de-errores-y-validacion.md) | Contrato público de errores (RFC 9457) y validación con Zod sin `nestjs-zod` | Aceptado | 2026-11-19 |
| [0009](0009-convenciones-de-datos.md) | Convenciones de datos, Prisma 7 en `packages/db` y flujo de migraciones | Aceptado | 2026-11-19 |
| [0010](0010-harness-de-integracion.md) | Harness de pruebas de integración y migraciones contra el contenedor desechable | Aceptado | 2026-11-19 |
