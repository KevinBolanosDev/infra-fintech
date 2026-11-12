# Skills y MCPs para el desarrollo con Claude Code

Nov 11, 2026 · @Kevin

## Resumen y cómo se instala

Para este stack alcanzan 5 MCPs núcleo y 10 skills externas; el control real lo dan las piezas propias del repositorio (CLAUDE.md, permisos, hooks, subagentes y skills del proyecto). Asumo que "Claude Console" significa Claude Code, ya sea desde la terminal integrada de VS Code o su extensión; todo lo de abajo vive en archivos del repositorio, así que funciona igual en ambos.

| Pieza | Qué es | Dónde vive | Para qué sirve aquí |
| --- | --- | --- | --- |
| MCP | Servidor que le da a Claude herramientas externas (docs, GitHub, base de datos, navegador) | `.mcp.json` (alcance de proyecto) | Consultar documentación vigente, revisar PRs, correr migraciones locales, probar la UI |
| Skill | Carpeta con un `SKILL.md` que Claude carga solo cuando la tarea coincide | `.claude/skills/<nombre>/` | Reglas de NestJS, Prisma, Next.js, Turborepo y de nuestro dominio |
| Subagente | Asistente especializado con herramientas limitadas | `.claude/agents/` | Revisar arquitectura, seguridad y pruebas sin tocar el código |
| Hook | Script que corre en eventos (antes o después de editar, al terminar) | `.claude/settings.json` | Hacer cumplir reglas de forma determinista |
| CLAUDE.md | Instrucciones fijas del proyecto | raíz y `apps/*` | Comandos, arquitectura y reglas no negociables |

**Mecánica de instalación**

- **MCPs:** se agregan con `claude mcp add` en alcance local, de proyecto o de usuario; los de proyecto se comparten mediante un `.mcp.json` versionado ([fuente](https://www.getmaxim.ai/articles/best-mcp-servers-for-claude-code)). Verifica con `/mcp` dentro de Claude Code.
- **Skills:** `npx skills add <dueño/repositorio> --skill <nombre> --agent claude-code` las instala en `.claude/skills/` del proyecto ([ejemplo](https://claudemarketplaces.com/skills/prisma/skills/prisma-cli)). Sin `--agent claude-code`, el CLI de skills.sh puede dejarlas en `.agents/skills/`, que Claude Code quizá no reconozca ([fuente](https://www.vibeindex.ai/skills/vercel-labs/agent-skills/vercel-react-best-practices)).
- **Plugins:** `/plugin marketplace add <repositorio>` y luego `/plugin install`; instala paquetes completos, así que se prefiere instalar skills sueltas.
- **Versionado:** se commitean `.mcp.json`, `.claude/skills/`, `.claude/agents/`, `.claude/settings.json` y `CLAUDE.md`; `.claude/settings.local.json` y los tokens quedan fuera de git.

**Límite de herramientas:** Claude Code ya carga las herramientas de los MCP bajo demanda, pero una guía de la comunidad advierte que con más de 5 a 7 servidores el agente se vuelve más lento y menos preciso ([fuente](https://github.com/Moh4696/50-essential-mcp-servers/wiki)). Las descripciones de las skills también consumen contexto: por eso se instalan solo las que se usan.

## MCPs recomendados

Cinco MCPs cubren el trabajo diario; los demás se agregan solo si aparece la necesidad. Context7, Playwright, GitHub y Sentry son de los más instalados hoy según [varias comparativas](https://www.paralect.com/mcp/top-development-mcp-servers), y las comparativas recomiendan servidores mantenidos por el propio proveedor ([fuente](https://www.getmaxim.ai/articles/best-mcp-servers-for-claude-code)).

### Núcleo

| MCP | Para qué en este proyecto | Desde | Riesgo |
| --- | --- | --- | --- |
| Context7 (Upstash) | Documentación vigente y por versión de NestJS, Prisma 7, Next.js, Better Auth y Turborepo; evita que Claude escriba APIs de memoria que ya cambiaron | Semana 1 | Bajo: no recibe código ni secretos, solo consultas |
| GitHub (oficial) | Revisar PRs, leer CI, abrir issues de cada compuerta de fase | Semana 1 | Medio: usar token de solo lectura o modo de solo lectura |
| Prisma (local) | `migrate-status`, `migrate-dev`, seeds y Studio contra la base de Docker | Fase 0 | Alto si apunta a datos reales; ver notas |
| Playwright (Microsoft) | Navegador real para verificar flujos de la PWA y escribir pruebas extremo a extremo | Fase 4 | Medio: solo contra localhost o staging |
| Sentry | Leer errores y trazas de staging dentro de la conversación | Fase 3 | Medio: limitar a un solo proyecto |

```bash
# Documentación vigente (la clave de API es opcional)
claude mcp add --scope project --transport http context7 https://mcp.context7.com/mcp

# GitHub: token fine-grained de solo lectura en una variable de entorno
claude mcp add --transport http github https://api.githubcopilot.com/mcp/ \
  --header "Authorization: Bearer ${GITHUB_PAT}"

# Prisma local (solo contra la base de Docker de desarrollo)
claude mcp add --scope project prisma-local -- npx -y prisma mcp

# Playwright: fijar la versión en lugar de @latest
claude mcp add --scope project playwright -- npx @playwright/mcp@<versión>

# Sentry limitado a un proyecto
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp/<org>/<proyecto>
```

Los comandos salen de las guías de cada proveedor y de las comparativas citadas; antes de instalar, confirma la sintaxis vigente en el README del servidor, sobre todo el encabezado de autenticación de GitHub.

### Notas por servidor

- **Prisma:** el servidor local expone `migrate-status`, `migrate-dev`, `migrate-deploy` y `migrate-reset` ([fuente](https://www.mintmcp.com/blog/prisma-mcp-servers)); este último borra la base. Se usa solo contra el Postgres de Docker y se bloquea `migrate-reset` y `migrate-deploy` en los permisos (ver sección de control). El servidor remoto de Prisma sirve para aprovisionar bases en su nube y no se necesita.
- **Playwright:** nunca con credenciales reales; para el simulador de proveedores usa cuentas sintéticas.
- **GitHub:** el servidor ofrece modos de solo lectura y de bloqueo ([fuente](https://dupple.com/learn/best-mcp-servers-claude-code)); úsalos mientras no necesites que Claude escriba en el repositorio.
- **Sentry:** el proveedor recomienda acotarlo a un proyecto para que el agente no recorra los demás ([fuente](https://www.paralect.com/mcp/top-development-mcp-servers)).

### Opcionales

| MCP | Cuándo vale la pena | Riesgo |
| --- | --- | --- |
| Docker MCP Gateway | Si quieres correr los MCPs en contenedores aislados: ejecuta `docker mcp client connect claude-code` y el gateway enruta a servidores del catálogo de Docker, cada uno en su contenedor ([fuente](https://docs.docker.com/ai/mcp-catalog-and-toolkit.md)). Encaja con el plan de trabajar en contenedores. Verifica si tu instalación de Linux lo soporta sin Docker Desktop | Bajo a medio |
| Servidor Postgres de solo lectura (por ejemplo DBHub) | Para consultar el ledger local en lenguaje natural y revisar índices; configurarlo con usuario de solo lectura y solo contra local | Medio |
| Better Auth (MCP alojado por Chonkie) | Ayuda guiada para configurar Better Auth; es un tercero alojado, así que nunca se le envían secretos ([fuente](https://smithery.ai/skills/bilalmk/configuring-better-auth)). Context7 ya cubre su documentación | Medio |
| Figma | Solo si existen diseños que implementar en la fase 4 | Bajo |
| Chrome DevTools (Google) | Rendimiento y depuración de la PWA en la fase 4 ([fuente](https://dev.to/iamthedev/20-mcp-servers-worth-wiring-into-claude-codex-and-gemini-3jd)) | Medio |

**No instalar:** servidores genéricos de sistema de archivos o de git (Claude Code ya trae esas herramientas), cualquier MCP con acceso a base de datos de producción, y cualquier servidor de pagos o de trading con llaves reales. Los riesgos de la tabla son mi valoración, no una calificación oficial.

## Skills recomendadas

Diez skills externas cubren el stack; todas se instalan con `--agent claude-code` para que queden en `.claude/skills/`. Antes de commitearlas, lee cada `SKILL.md` y sus scripts: una skill son instrucciones que Claude seguirá como propias.

| Herramienta | Skill | Fuente | Instalación | Nota |
| --- | --- | --- | --- | --- |
| Turborepo | `turborepo` | [Vercel](https://skills.browseract.com/skills/vercel-turborepo-turborepo) | `npx skills add vercel/turborepo --skill turborepo --agent claude-code` | Tareas por paquete en lugar de en la raíz, caché, `--affected` y límites entre paquetes |
| Prisma | `prisma-cli` | [Prisma (oficial)](https://www.prisma.io/docs/ai/tools/skills) | `npx skills add prisma/skills --skill prisma-cli --agent claude-code` | Comandos y flujo de migraciones de la versión 7 |
| Prisma | `prisma-client-api` | Prisma (oficial) | `npx skills add prisma/skills --skill prisma-client-api --agent claude-code` | Consultas, transacciones y SQL crudo de la versión 7 |
| NestJS | `nestjs-best-practices` | [xirothedev](https://claudemarketplaces.com/skills/xirothedev/agent-skills/nestjs-best-practices) | `npx -y skills add xirothedev/agent-skills --skill nestjs-best-practices --agent claude-code` | 26 reglas (seguridad, arquitectura, validación, Prisma 7, pruebas); está pensada para Bun, así que se adaptan las reglas de runtime a Node |
| NestJS | `bambu-nest-test` | [Bambu Developers](https://github.com/Bambu-Developers/skills) | `npx skills add Bambu-Developers/skills --skill bambu-nest-test --agent claude-code` | Patrones de pruebas unitarias para NestJS con Prisma (DTO, servicio, controlador, módulo); apoya nuestra política de pruebas |
| Next.js y React | `vercel-react-best-practices` | [Vercel](https://examples.vercel.com/docs/agent-resources/skills) | `npx skills add vercel-labs/agent-skills --skill vercel-react-best-practices --agent claude-code` | Más de 40 reglas de rendimiento en 8 categorías |
| Next.js | `next-best-practices` | Vercel | Busca con `npx skills find next-best-practices` | Convenciones de archivos, límites de Server Components y patrones de datos |
| UI | `web-design-guidelines` | Vercel | `npx skills add vercel-labs/agent-skills --skill web-design-guidelines --agent claude-code` | Revisión de interfaz y accesibilidad |
| UI | `frontend-design` | [Anthropic](https://skillselion.com/guides/anthropic-skills-official-guide) | `npx skills add anthropics/skills --skill frontend-design --agent claude-code` | Calidad visual con React y Tailwind; la más instalada del repositorio oficial |
| Skills propias | `skill-creator` | Anthropic | `npx skills add anthropics/skills --skill skill-creator --agent claude-code` | La usas para escribir las skills de la siguiente sección |

**Opcionales**

- `webapp-testing` (Anthropic): prueba apps locales con Playwright; se solapa con el MCP de Playwright, así que solo si prefieres no instalar el MCP.
- `vercel-composition-patterns`: patrones de componentes para el `packages/ui` de la fase 4.
- [`nestjs-hexagonal`](https://github.com/Softtor/nestjs-hexagonal) (plugin comunitario): modelado por capas con DDD y CQRS, con agentes por capa y una revisión de cumplimiento de arquitectura. Es más pesado de lo que necesitamos (CQRS); úsalo como inspiración para nuestras propias skills.

**Lo que no encontré**

- No encontré una skill oficial de Better Auth verificada. Hay skills comunitarias ([ejemplo](https://claudskills.com/skills/better-auth-skill/)), pero la mejor base hoy es Context7 con la documentación oficial; si instalas una comunitaria, revisa su contenido primero.
- No encontré una skill reconocida de Docker Compose ni de Testcontainers; van como skills propias.

**Cuidado con los paquetes completos:** instalar a la vez los plugins `document-skills` y `claude-api` del repositorio oficial de Anthropic carga 17 skills dos veces, y las descripciones de skills comparten un presupuesto de contexto limitado ([reporte](https://github.com/anthropics/claude-code/issues/53426)). Por eso aquí se instala cada skill por separado.

## Skills propias del proyecto

Las skills externas enseñan el stack; las propias enseñan nuestro dominio y son lo que más protege la arquitectura. Se escriben con `skill-creator` en `.claude/skills/` y se versionan en el repositorio. Se llevan a la semana 0 con una versión corta y se refinan en cada fase.

| Skill | Cuándo se activa | Qué impone | Fase |
| --- | --- | --- | --- |
| `ledger-rules` | Tocar `ledger`, asientos, saldos o `Money` | Dinero en `BigInt` de centavos; partida doble que suma cero; solo inserción y reversas; trigger diferido en una migración SQL; prueba de propiedades obligatoria | 1 |
| `nest-module-scaffold` | Crear un módulo de NestJS | Capas `domain`, `application`, `infrastructure` e `interface`; reglas de importación; plantilla de pruebas por archivo; entradas en `audit` y `outbox` | 0 |
| `testing-policy` | Crear o cambiar cualquier archivo con lógica | La tabla de pruebas del plan: qué prueba exige cada tipo de archivo y su umbral | 0 |
| `provider-adapter` | Integrar o simular un proveedor | Interfaz en `packages/integrations`, implementación simulada y real, webhook con idempotencia y confirmación por consulta, prueba de contrato, variables `*_PROVIDER` | 2 |
| `prisma-migration-safety` | Cambiar `schema.prisma` o crear una migración | Migraciones en dos pasos, SQL adicional para triggers y permisos, nunca editar una migración aplicada, revisar el SQL generado | 1 |
| `audit-events` | Acciones que cambian estado o dinero | Qué se registra en `audit_log`, formato del evento, enmascarado de datos personales en logs | 1 |
| `fsd-slice` | Crear una funcionalidad en la web | Capas de FSD, dirección de importaciones, dónde va cada archivo, historia de Storybook y pruebas | 4 |
| `phase-gate` | Cerrar una fase | Checklist con los criterios de salida del plan; falla si falta alguno | Todas |

**Plantilla de una skill propia**

```markdown
---
name: ledger-rules
description: Use when creating or changing ledger accounts, entries, balances, Money values or any code that moves value. Triggers: "ledger", "asiento", "saldo", "reversa", "Money".
---

# Ledger rules

1. Money is `bigint` cents. Never float or Decimal.
2. Every ledger_transaction must sum to zero.
3. Entries are insert-only. Fix mistakes with a reversal entry.

Details: see rules/double-entry.md, rules/reversals.md, rules/tests.md
```

**Buenas prácticas para escribirlas**

- El campo `description` es lo único que Claude ve para decidir si carga la skill: enuméralo con frases concretas que activan la skill ([guía](https://github.com/Bambu-Developers/skills)).
- Mantén `SKILL.md` como índice corto y mueve el detalle a archivos `rules/*.md` que se cargan solo cuando hacen falta.
- Escribe para un agente futuro: cuándo cargarla, pasos, y las restricciones que no se negocian.
- Cada skill propia lleva un caso de prueba manual: un prompt de ejemplo que debe activarla y el resultado esperado.

## Control total: CLAUDE.md, permisos, hooks y subagentes

La regla de diseño: CLAUDE.md es una petición, los hooks son una puerta cerrada y los permisos hacen que la puerta no exista ([guía de hooks](https://agentic.proxify.io/setup/hooks-playbook.md)). Lo que importa se respalda con un hook, y lo que es un límite de seguridad también se aplica en permisos y en CI.

### Capas de control

| Capa | Qué garantiza | Qué no garantiza |
| --- | --- | --- |
| `CLAUDE.md` | Contexto y convenciones; Claude suele seguirlas | No es obligatorio: puede ignorarlas |
| Skills | Reglas detalladas cargadas cuando aplican | Depende de que la descripción las active |
| Permisos (`settings.json`) | Bloquear o pedir confirmación para comandos y rutas | Hubo versiones donde las reglas `deny` no se aplicaban ([reporte](https://github.com/anthropics/claude-code/issues/6699)); verifica en tu versión |
| Hooks | Ejecución determinista antes o después de cada acción | Corren con tus permisos; el contenido que reciben es entrada no confiable |
| Subagentes | Revisión especializada y de solo lectura | Un reporte indica que no heredan los hooks ni los permisos del proyecto ([reporte](https://github.com/anthropics/claude-code/issues/27661)); define los suyos |
| CI | La barrera final que nadie puede saltarse en local | Solo ve lo que llega al PR |

### CLAUDE.md

Uno corto en la raíz (comandos `pnpm`, mapa del monorepo, reglas no negociables, dónde está el plan) y uno por aplicación (`apps/api/CLAUDE.md`, `apps/web/CLAUDE.md`) con sus capas y su política de pruebas. Reglas mínimas para la raíz:

- Dinero siempre en centavos y `BigInt`.
- Ningún acceso a proveedores reales: solo adaptadores y el simulador.
- Ningún archivo con lógica sin sus pruebas.
- Las importaciones entre capas siguen la tabla de dependencias del plan.
- Nunca editar una migración aplicada ni leer archivos `.env`.

### Permisos de proyecto (`.claude/settings.json`)

```json
{
  "permissions": {
    "allow": [
      "Bash(pnpm turbo run *)",
      "Bash(pnpm test*)",
      "Bash(pnpm prisma migrate dev*)",
      "Bash(docker compose *)"
    ],
    "ask": ["Bash(git push*)", "Bash(pnpm add*)", "Bash(pnpm prisma migrate status*)"],
    "deny": [
      "Read(./.env*)",
      "Bash(pnpm prisma migrate reset*)",
      "Bash(pnpm prisma migrate deploy*)",
      "Bash(git push --force*)",
      "Bash(rm -rf*)"
    ]
  }
}
```

La sintaxis exacta de las reglas varía entre versiones de Claude Code; comprueba cada regla con una prueba real (pedir a Claude que lea un `.env` y verificar que falla) en lugar de asumir que funciona.

### Hooks que hacen cumplir el plan

| Evento | Hook | Efecto |
| --- | --- | --- |
| `PostToolUse` en `Write` y `Edit` | Prettier y ESLint con corrección sobre el archivo editado | Estilo uniforme sin depender de la memoria del agente |
| `PreToolUse` en `Write` y `Edit` | Bloquea editar migraciones ya aplicadas, `.env*` y `pnpm-lock.yaml` a mano | Protege el historial de la base y las dependencias |
| `PreToolUse` en `Bash` | Bloquea comandos destructivos, `curl` a dominios fuera de una lista y `--no-verify` | Evita atajos peligrosos |
| `Stop` | Ejecuta `turbo run lint typecheck test --filter=...[HEAD]` | La tarea no se da por terminada si rompe pruebas, tipos o reglas de dependencia |
| `UserPromptSubmit` (opcional) | Recuerda la fase actual y su compuerta | Mantiene a Claude alineado con el plan |

Los hooks reciben un JSON por entrada estándar y se comunican con códigos de salida; el código 2 bloquea la acción ([documentación](https://code.claude.com/docs/en/hooks-guide)). Los scripts viven en `.claude/hooks/` y se tratan como código de producción: con pruebas, revisados en PR.

### Subagentes (`.claude/agents/`)

| Subagente | Herramientas | Qué revisa |
| --- | --- | --- |
| `architect-reviewer` | Solo lectura (`Read`, `Grep`, `Glob`) | Reglas de dependencia entre paquetes y capas, FSD, tamaño de módulos |
| `test-writer` | Lectura y escritura solo en archivos de prueba | Escribe las pruebas que exige la política para el cambio actual |
| `security-reviewer` | Solo lectura | Autorización por recurso, datos personales en logs, webhooks, secretos, hooks de auditoría |
| `db-reviewer` | Solo lectura | Migraciones, índices, transacciones del ledger |

```markdown
---
name: architect-reviewer
description: Reviews changes against the monorepo dependency rules and module layering. Use proactively after creating or moving files.
tools: Read, Grep, Glob
model: sonnet
---
Check imports against docs/architecture-rules.md. Report violations with file and line. Do not edit files.
```

### Comandos de flujo

Atajos con `/` (skills invocables) para `new-module`, `review-pr`, `phase-gate` y `adr`, para que cada cambio siga el mismo camino.

### La barrera final: CI

Todo lo anterior puede fallar por una versión o una configuración local; CI no. Se mantienen en el pipeline las reglas de dependencia (`dependency-cruiser` o `eslint-plugin-boundaries`), los umbrales de cobertura, el escaneo de secretos y dependencias, y la plantilla de PR con la casilla de pruebas. Los archivos `.claude/`, `.mcp.json` y `CLAUDE.md` van en `CODEOWNERS` para que ningún cambio de configuración del agente se fusione sin revisión.

### Prácticas de trabajo

- Modo plan antes de cambios grandes; PRs pequeños, uno por módulo o por compuerta.
- Un ADR (registro de decisión) corto por cada decisión de arquitectura que Claude proponga y tú aceptes.
- Revisión humana obligatoria en `ledger`, `auth`, `provider-events`, migraciones y todo lo que toque dinero.

## Seguridad de MCPs y skills en un proyecto fintech

Instalar una skill o un MCP es dar instrucciones y acceso a un tercero dentro de tu máquina; el ecosistema ya tiene incidentes documentados, así que cada instalación pasa por una revisión.

### Por qué importa

- En enero de 2026, una auditoría de 2.857 skills del registro ClawHub encontró 341 maliciosas, cerca del 12 % ([Snyk](https://snyk.io/articles/skill-md-shell-access/)).
- La auditoría ToxicSkills de febrero de 2026 revisó 3.984 skills de ClawHub y skills.sh: confirmó 76 con carga maliciosa activa, y el 91 % de las confirmadas combinaba malware con inyección de instrucciones ([resumen](https://obot.ai/?p=2601)).
- Dos fallos de configuración de Claude Code (CVE-2025-59536) permitían ejecutar código mediante hooks de MCP, variables de entorno y archivos de configuración manipulados ([artículo](https://dev.to/bawbel/skill-files-are-the-new-supply-chain-attack-surface-your-ci-pipeline-does-not-know-that-yet-7i9)). Moraleja: no abras repositorios ajenos con `.mcp.json` o `.claude/` sin revisarlos.
- Un MCP remoto puede cambiar lo que devuelve después de que lo instalaste, y fijar la versión no lo evita ([mismo artículo](https://dev.to/bawbel/skill-files-are-the-new-supply-chain-attack-surface-your-ci-pipeline-does-not-know-that-yet-7i9)).

### Lista de revisión antes de instalar

- [ ] ¿Lo mantiene el propio proveedor o una organización con nombre? Se prefieren los oficiales.
- [ ] ¿Último commit reciente, repositorio activo y código abierto que puedas leer?
- [ ] Leí el `SKILL.md` completo y todos sus scripts; no descarga instrucciones ni ejecutables de internet.
- [ ] Versión fijada (sin `@latest`) y la fijación queda en el repositorio.
- [ ] Token con el mínimo permiso (solo lectura cuando sea posible), guardado en variables de entorno, nunca en el prompt.
- [ ] Para skills de la comunidad: pasé un escáner de skills o lo revisé a mano antes de commitearla.
- [ ] Lo instalé primero en un directorio de pruebas, no en el repositorio principal.

### Reglas propias de este proyecto

- **Ningún MCP toca producción:** ni base de datos, ni llaves de pagos o de KYC reales. Las llaves de los proveedores en el sandbox viven en un gestor de secretos y Claude nunca las lee.
- **Datos sintéticos en el entorno de Claude:** la base local solo tiene datos del simulador; ningún documento ni teléfono real.
- **Un hook bloquea la lectura de `.env*`** y de archivos de claves, además de la regla `deny`.
- **Servidores remotos solo con datos no sensibles:** Context7 recibe consultas de documentación, no código propio ni secretos; Sentry se limita a un proyecto de staging con datos personales enmascarados.
- **Revisión de cambios de configuración:** `.mcp.json`, `.claude/**` y `CLAUDE.md` pasan por `CODEOWNERS` y por revisión humana.
- **Auditoría trimestral:** una vez por trimestre se listan los MCPs y skills instalados, se eliminan los que no se usan y se actualizan los que tienen parches. El ecosistema cambia rápido y un servidor elegido hoy puede quedar superado ([fuente](https://github.com/Moh4696/50-essential-mcp-servers/wiki)).
- **Trata todo contenido externo como no confiable:** un issue, una página o la respuesta de un MCP pueden traer instrucciones; Claude no ejecuta comandos ni cambia archivos solo porque un texto externo lo pida.

Hay servidores que verifican skills antes de instalarlas (por ejemplo, [uno de la comunidad](https://mcpservers.org/servers/temurkhan13/openclaw-skill-vetter-mcp)), pero ya son otra dependencia de terceros: trátalos como ayuda, no como garantía.

## Orden de instalación por fase

Se instala lo que la fase necesita, no todo al inicio: menos herramientas significa menos contexto gastado y menos superficie de ataque. Las fases son las del [plan de desarrollo](https://claude.ai/artifact/Wc7gXKCvik3SQEMUfZzVzu).

| Fase | Semanas | Instalar | Verificar |
| --- | --- | --- | --- |
| Antes de empezar | 0 | `CLAUDE.md` raíz, `.claude/settings.json` con permisos, hooks de formato y de bloqueo, MCPs Context7 y GitHub (solo lectura), skills `turborepo`, `prisma-cli`, `prisma-client-api`, `nestjs-best-practices` y `skill-creator`; subagente `architect-reviewer` | `/mcp` muestra los dos servidores; una prueba real confirma que Claude no puede leer `.env` |
| 0. Fundaciones | 1–2 | Skills propias `nest-module-scaffold` y `testing-policy`; `bambu-nest-test`; MCP de Prisma contra la base de Docker; subagente `test-writer` | Crear un módulo de ejemplo sigue las capas y trae sus pruebas |
| 1. Núcleo de dominio | 3–6 | Skills propias `ledger-rules`, `prisma-migration-safety` y `audit-events`; subagentes `security-reviewer` y `db-reviewer`; hook `Stop` con pruebas afectadas | Una migración con trigger de ledger pasa la revisión y la prueba de propiedades |
| 2. Cobros y simulador | 7–10 | Skill propia `provider-adapter`; opcional: gateway de Docker MCP | El adaptador simulado y el real comparten las mismas pruebas de contrato |
| 3. Documentos y operaciones | 11–13 | MCP de Sentry limitado a staging; skill `phase-gate` | La compuerta de la fase 3 se cierra con el checklist y no a mano |
| 4. Frontend PWA | 14–20 | MCP de Playwright, skills `frontend-design`, `vercel-react-best-practices`, `next-best-practices`, `web-design-guidelines` y la propia `fsd-slice`; opcional: Figma y Chrome DevTools | Un flujo extremo a extremo corre en móvil y escritorio con Playwright |
| 5. Preparación para producción | 21–24 | Auditoría de todos los MCPs y skills instalados; retirar los que sobren; revisión de permisos y hooks | Ningún MCP tiene acceso a producción y la lista de revisión de seguridad está completa |

### Primer día: pasos concretos

1. Crea el repositorio con el monorepo vacío y haz el primer commit.
2. Escribe `CLAUDE.md` y `.claude/settings.json` (permisos y los dos hooks de bloqueo) y haz otro commit.
3. Instala Context7 y GitHub con `claude mcp add` y verifica con `/mcp`.
4. Instala las cinco skills de la semana 0 con `--agent claude-code` y lee cada `SKILL.md` antes de commitearlas.
5. Crea `architect-reviewer` en `.claude/agents/`.
6. Haz una prueba de humo: pide a Claude que cree un módulo vacío y comprueba que respeta las capas, trae sus pruebas y que el hook bloquea editar un `.env`.

### Qué no verifiqué

Los comandos y los números de instalaciones salen de búsquedas web y de las guías de cada proveedor, no de una instalación real; la sintaxis de `claude mcp add`, de las reglas de permisos y de los hooks cambia entre versiones de Claude Code. Antes de adoptar cada pieza, comprueba su README o la documentación oficial, y prueba cada regla de seguridad con una acción real.

### Fuentes

- [Comparativa de MCPs (Parallel)](https://parallel.ai/articles/best-mcp-servers-for-claude-code)
- [15 mejores MCPs y gateway (Maxim)](https://www.getmaxim.ai/articles/best-mcp-servers-for-claude-code)
- [MCPs por trabajo (DEV Community)](https://dev.to/dublecc/best-mcp-servers-for-claude-code-in-2026-a-curated-job-by-job-guide-1bnd)
- [MCPs para desarrollo (Paralect)](https://www.paralect.com/mcp/top-development-mcp-servers)
- [Prisma MCP (repositorio)](https://github.com/prisma/mcp)
- [Docker MCP Catalog y Toolkit](https://docs.docker.com/ai/mcp-catalog-and-toolkit.md)
- [Skills de Prisma](https://www.prisma.io/docs/ai/tools/skills)
- [Skills de Vercel](https://examples.vercel.com/docs/agent-resources/skills)
- [Skills oficiales de Anthropic (guía)](https://skillselion.com/guides/anthropic-skills-official-guide)
- [Skill de Turborepo](https://skills.browseract.com/skills/vercel-turborepo-turborepo)
- [Skills de Bambu (NestJS + Prisma)](https://github.com/Bambu-Developers/skills)
- [Hooks en Claude Code](https://code.claude.com/docs/en/hooks-guide)
- [Snyk: skills y acceso al shell](https://snyk.io/articles/skill-md-shell-access/)
- [ToxicSkills (resumen)](https://obot.ai/?p=2601)
