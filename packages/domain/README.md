# @repo/domain

Núcleo de dominio: tipos, puertos y reglas **puras**. No importa nada externo ni ningún otro paquete interno (`docs/architecture-rules.md`). Paquete compilado (ADR-0005); perfil de cobertura `domain` (90 % de ramas).

| Ruta | Contenido |
| --- | --- |
| `src/clock/clock.ts` | Puerto `Clock { now(): Promise<Date> }` (ADR-0011). Solo la capa `application` lo llama; las reglas reciben la fecha como argumento |
| `src/errors/domain-error.ts` | `DomainError` (código estable y mensaje público) y `ERROR_CODE_PATTERN`, copia del de `@repo/contracts` comprobada en `apps/api` |

Dinero en `bigint` de centavos y cálculos con redondeo explícito (regla 1 de `CLAUDE.md`) cuando lleguen las reglas de negocio (Fase 1).
