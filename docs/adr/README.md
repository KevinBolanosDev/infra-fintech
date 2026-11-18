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
| [0002](0002-herramienta-de-fronteras.md) | Herramienta que hace cumplir las reglas de dependencia | Propuesto | 2026-11-13 |
| [0003](0003-capas-y-ubicacion-de-modulos.md) | Capas confirmadas y ubicación de los módulos compartidos | Propuesto | 2026-11-13 |
