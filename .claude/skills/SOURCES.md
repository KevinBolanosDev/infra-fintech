# Procedencia de las skills externas

Instaladas el 2026-11-11 por copia desde un clon fijado al commit indicado (no con `npx skills add`:
`skills@1.8.1` exige Node >= 22.20 y la máquina tenía Node 20.20.2). Cada `SKILL.md` y sus scripts
fueron leídos antes de copiarse. Para actualizar una skill: clonar el repo al commit nuevo, releer el diff y volver a copiar.

| Skill | Repositorio | Ruta en el repo | Commit |
| --- | --- | --- | --- |
| turborepo | vercel/turborepo | skills/turborepo | 4e3bdf1eff825764acff269b8e71760e5e5c9300 |
| prisma-cli | prisma/skills | prisma-cli | a6f192959cf43b08aa330fe1ffca090267215812 |
| prisma-client-api | prisma/skills | prisma-client-api | a6f192959cf43b08aa330fe1ffca090267215812 |
| nestjs-best-practices | xirothedev/agent-skills | skills/nestjs-best-practices | 0c98fc9cacff3854b33d9df540aac4f1a66cf297 |
| vercel-react-best-practices | vercel-labs/agent-skills | skills/react-best-practices | 1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62 |
| web-design-guidelines (**modificada**) | vercel-labs/agent-skills | skills/web-design-guidelines | 1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62 |
| ↳ `guidelines.md` | vercel-labs/web-interface-guidelines | command.md | 434b7f91364665f2f733b310ec54809bf8f37937 |

## Notas de revisión

- `nestjs-best-practices` está escrita para Bun (`bun add`, `Bun.password`); este proyecto usa pnpm y Node. Último commit: 2026-01-27.
- `turborepo` solo remite a `node_modules/turbo/docs/README.md`; es útil una vez instalado `turbo`.
- `skill-creator`: **no está en el proyecto**. Se instaló y se retiró el 2026-11-11 porque la sesión ya dispone de
  `anthropic-skills:skill-creator` (global) y duplicaba la descripción en el contexto. Revisada antes de retirarla
  (anthropics/skills @ 2c5958ecac7cee2b583967a2c4981d0f4a75c579): ejecuta `claude -p`, `lsof` + SIGTERM sobre su
  puerto (3117) y un servidor HTTP local en 127.0.0.1. Si se trabaja sin la global, reinstalarla desde ese commit.
- `web-design-guidelines`: la original ordena descargar las reglas de `raw.githubusercontent.com/.../main/command.md`
  en cada uso y aplicarlas junto con sus instrucciones de salida. Eso incumple "no descarga instrucciones de internet",
  así que se reemplazó la descarga por la copia local `guidelines.md` (fijada al commit de arriba, 191 líneas, revisada).
  El `SKILL.md` es lo único que se editó. `LICENSE-guidelines.txt` es la licencia (MIT) del repo de las reglas.
- `vercel-react-best-practices`: 75 `.md` + 1 `.json`, sin scripts. El directorio upstream se llama `react-best-practices`;
  se instala con el nombre de su `name:` para que coincida.

## Revisadas y NO instaladas (decisión al llegar a la fase)

- `frontend-design` (fase 4): el plugin global `frontend-design@claude-plugins-official` (1.1.1) ya la aporta y su
  `SKILL.md` es idéntico al de `anthropics/skills`. Instalar otra copia duplicaría la descripción en el contexto.
- `next-best-practices` (fase 4): ya no existe como skill. `vercel-labs/next-skills` se movió a `vercel/next.js`; ese conocimiento
  viene con la documentación empaquetada de Next.js y los `AGENTS.md`/`CLAUDE.md` que genera `next dev` (Next.js >= 16.3);
  en 16.1 o anterior: `npx @next/codemod@canary agents-md`. Las skills actuales de `vercel/next.js/skills` son de flujos
  (`next-cache-components-*`, `next-partial-prefetching-*`, `next-bundle-optimizer`, `next-dev-loop`).
- `bambu-nest-test` (fase 0): es la convención interna del monorepo de Bambu (mocks de `I18nService`, rutas `apps/<servicio>`
  y `libs/`, "sobrescribe el consejo genérico", exige `bambu-nest-rules`) y obliga a mockear siempre `PrismaService`,
  lo que choca con probar el ledger contra Postgres real. Mejor como inspiración para `testing-policy`.
  Commit revisado: b91cd017d9304968f8642866685be62ef666738d.
