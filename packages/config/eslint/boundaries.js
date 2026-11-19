// @ts-check
// Reglas de dependencia ejecutables: docs/architecture-rules.md (secciones 1, 2 y 3), ADR-0002 y ADR-0003.
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

/** Apps del monorepo (`apps/<nombre>`). Una app nunca importa de otra. */
export const APPS = /** @type {const} */ (['api', 'worker', 'provider-sim', 'web']);

/** Paquetes del monorepo (`packages/<nombre>`). */
export const PACKAGES = /** @type {const} */ ([
  'domain',
  'contracts',
  'db',
  'integrations',
  'observability',
  'testing',
  'config',
  'platform',
  'api-client',
  'ui',
]);

/**
 * Qué paquetes internos puede importar cada app o paquete (sección 1 + filas de D-07).
 * Todo lo que no figura aquí está prohibido (`default: "disallow"`).
 * `config` es tooling (tsconfig, ESLint, Vitest) y lo puede importar cualquiera.
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const ALLOWED_INTERNAL = {
  domain: [],
  contracts: [],
  db: ['domain'], // solo tipos: ver la política de `db` más abajo
  integrations: ['domain', 'contracts'],
  observability: [],
  testing: ['domain', 'contracts', 'db', 'platform'],
  config: [],
  platform: ['domain', 'contracts', 'db', 'observability'],
  'api-client': ['contracts'],
  ui: [],
  api: ['domain', 'contracts', 'db', 'integrations', 'observability', 'platform', 'testing'],
  worker: ['domain', 'contracts', 'db', 'integrations', 'observability', 'platform', 'testing'],
  'provider-sim': ['contracts', 'integrations'],
  web: ['contracts', 'api-client', 'ui', 'domain'],
};

/** Capas FSD de `apps/web`, de arriba hacia abajo (sección 3). */
export const WEB_LAYERS = /** @type {const} */ ([
  'web-app',
  'web-core',
  'web-views',
  'web-widgets',
  'web-features',
  'web-entities',
  'web-shared',
]);

/** Módulos externos que solo pueden importarse desde `infrastructure/` o `packages/db`. */
const PRISMA_MODULES = ['@prisma/*', '@prisma/**', 'prisma', 'prisma/**'];

/** Apps y paquetes cuyo `infrastructure/` puede usar `@repo/db` y Prisma (salvo `testing`, que lo usa entero). */
const DB_CONSUMERS = Object.entries(ALLOWED_INTERNAL)
  .filter(([name, allowed]) => allowed.includes('db') && name !== 'testing')
  .map(([name]) => name);

/** Apps y paquetes cuyas pruebas pueden usar `@repo/testing` (M-2). */
const TESTING_CONSUMERS = ['api', 'worker', 'platform'];

/** @param {string} name */
function folderOf(name) {
  return /** @type {readonly string[]} */ (APPS).includes(name)
    ? `apps/${name}`
    : `packages/${name}`;
}

/**
 * Cualquier archivo dentro de la app o paquete `names`, incluidas sus capas y slices. Se selecciona
 * por ruta de archivo (no por jerarquía de elementos) para que no dependa de qué elemento interno
 * (capa hexagonal o capa FSD) reciba el archivo.
 * @param {string | readonly string[]} names
 */
function inside(names) {
  const list = typeof names === 'string' ? [names] : [...names];
  return list.map((name) => ({ file: { path: `${folderOf(name)}/**` } }));
}

/** @param {string} layer */
function hexLayer(layer) {
  return { element: { type: 'layer', captured: { layer } } };
}

/** @param {readonly string[]} sources */
function externalModules(sources) {
  return { module: { origin: /** @type {const} */ (['external', 'core']), source: [...sources] } };
}

/**
 * Descriptores de elementos. El plugin compara de derecha a izquierda y se queda con el elemento
 * más interno: una capa hexagonal (`.../src/**\/<capa>`) gana a su app o paquete. Las capas FSD
 * llevan la ruta completa desde la raíz, así que solo coinciden en su sitio, y cada slice es su
 * propio elemento (los slices de una misma capa no se ven entre sí).
 */
function elementDescriptors() {
  return [
    {
      type: 'layer',
      pattern: '{domain,application,infrastructure,interface}',
      // apps/web usa FSD, no capas hexagonales: una carpeta `infrastructure/` allí sigue en su capa FSD.
      basePattern: '{apps/api,apps/worker,apps/provider-sim,packages/*}/src/**',
      capture: ['layer'],
    },
    { type: 'web-app', pattern: 'apps/web/app' },
    { type: 'web-core', pattern: 'apps/web/src/core' },
    ...['views', 'widgets', 'features', 'entities'].map((layer) => ({
      type: `web-${layer}`,
      pattern: `apps/web/src/${layer}/*`,
      capture: ['slice'],
    })),
    { type: 'web-shared', pattern: 'apps/web/src/shared' },
    ...APPS.map((name) => ({ type: name, pattern: `apps/${name}` })),
    ...PACKAGES.map((name) => ({ type: name, pattern: `packages/${name}` })),
  ];
}

/** Políticas en orden: la última que coincide gana. */
function dependencyPolicies() {
  const everyElement = [...APPS, ...PACKAGES];

  return [
    // 1. Cualquier archivo puede importar módulos externos y del núcleo de Node (se restringen abajo).
    { allow: { to: { module: { origin: ['external', 'core'] } } } },

    // 2. Dentro de una misma app o paquete, sus capas y archivos se ven entre sí (las capas se restringen abajo).
    ...everyElement.map((type) => ({ from: inside(type), allow: { to: inside(type) } })),

    // 3. Sección 1 y D-07: paquetes internos permitidos. Sin entrada para quien no puede importar
    //    ningún paquete interno: un `to: []` es un selector inválido que el plugin solo avisa.
    ...everyElement
      .filter((type) => (ALLOWED_INTERNAL[type] ?? []).length > 0)
      .map((type) => ({
        from: inside(type),
        allow: { to: inside(ALLOWED_INTERNAL[type] ?? []) },
      })),

    // 3.0 `config` (tooling) solo desde archivos de configuración (`*.config.{js,ts}`), de cualquiera.
    { from: { file: { categories: 'config' } }, allow: { to: inside('config') } },

    // 3.1 `db` importa `domain` solo como tipos.
    {
      from: inside('db'),
      disallow: { to: inside('domain') },
      message: 'packages/db solo puede importar tipos de domain (import type).',
    },
    { from: inside('db'), dependency: { kind: 'type' }, allow: { to: inside('domain') } },

    // 3.2 `domain` no importa nada externo (solo TypeScript).
    {
      from: inside('domain'),
      disallow: { to: { module: { origin: ['external', 'core'] } } },
      message: 'packages/domain no importa nada externo: ni NestJS, ni Prisma, ni HTTP, ni Node.',
    },

    // 3.3 `contracts` solo importa zod.
    {
      from: inside('contracts'),
      disallow: { to: { module: { origin: ['external', 'core'] } } },
      message: 'packages/contracts solo puede importar zod.',
    },
    { from: inside('contracts'), allow: { to: externalModules(['zod', 'zod/*']) } },

    // 3.4 `observability` solo usa pino, OpenTelemetry, Sentry y el núcleo de Node.
    {
      from: inside('observability'),
      disallow: { to: { module: { origin: 'external' } } },
      message: 'packages/observability solo puede importar pino, OpenTelemetry y Sentry.',
    },
    {
      from: inside('observability'),
      allow: { to: externalModules(['pino', 'pino-*', '@opentelemetry/*', '@sentry/*']) },
    },

    // 3.5 `testing` solo se importa desde las pruebas de api, worker y platform.
    {
      disallow: { to: inside('testing') },
      message: 'packages/testing solo se importa desde las pruebas de api, worker y platform.',
    },
    {
      from: TESTING_CONSUMERS.map((name) => ({
        file: { categories: 'test', path: `${folderOf(name)}/**` },
      })),
      allow: { to: inside('testing') },
    },
    { from: inside('testing'), allow: { to: inside('testing') } },

    // 4. Sección 2: capas hexagonales dentro de cada módulo.
    // 4.0 domain/ es lista cerrada: solo su propia carpeta (dependencia interna, no se evalúa) y
    //     @repo/domain. Nada externo, ninguna otra capa ni módulo, ningún otro paquete.
    {
      from: hexLayer('domain'),
      disallow: {
        to: [{ module: { origin: ['external', 'core'] } }, { module: { origin: 'local' } }],
      },
      message:
        'La capa domain/ solo importa su propio domain/ y @repo/domain: nada externo, ni otras capas o módulos.',
    },
    { from: hexLayer('domain'), allow: { to: inside('domain') } },
    {
      from: hexLayer('application'),
      disallow: { to: [hexLayer('infrastructure'), hexLayer('interface')] },
      message:
        'La capa application/ solo importa domain/ (y sus puertos); nunca infrastructure/ ni interface/.',
    },
    {
      from: hexLayer('infrastructure'),
      disallow: { to: hexLayer('interface') },
      message: 'La capa infrastructure/ no importa interface/.',
    },
    {
      from: hexLayer('interface'),
      disallow: { to: hexLayer('infrastructure') },
      message:
        'La capa interface/ no importa infrastructure/: recibe las implementaciones por inyección.',
    },

    // 4.1 Pruebas y archivos de configuración pueden importar cualquier módulo externo o del núcleo
    //     de Node (vitest, fast-check, eslint/config…), aunque su paquete o capa restrinja los
    //     externos. Las reglas entre paquetes internos y la de Prisma (más abajo) siguen aplicando.
    {
      from: [{ file: { categories: 'test' } }, { file: { categories: 'config' } }],
      allow: { to: { module: { origin: ['external', 'core'] } } },
    },

    // 4.2 Prisma (y @repo/db) solo en infrastructure/ y en packages/db.
    {
      disallow: { to: [externalModules(PRISMA_MODULES), ...inside('db')] },
      message: 'Prisma solo se usa en infrastructure/ y en packages/db.',
    },
    // Excepción acotada: solo infrastructure/ de quien ya puede importar db (api, worker, platform),
    // más packages/db y packages/testing. Como "la última que coincide gana", un `from` más amplio
    // (cualquier infrastructure/) reabriría db y Prisma a paquetes que nunca pueden usarlos.
    {
      from: [
        ...DB_CONSUMERS.map((name) => ({
          element: { type: 'layer', captured: { layer: 'infrastructure' } },
          file: { path: `${folderOf(name)}/**` },
        })),
        ...inside('db'),
        ...inside('testing'),
      ],
      allow: { to: [externalModules(PRISMA_MODULES), ...inside('db')] },
    },

    // 5. Sección 3: FSD en apps/web. Cada capa solo importa de las de abajo; los slices de una
    //    misma capa no se importan entre sí (cada slice es su propio elemento).
    ...WEB_LAYERS.map((layer, index) => ({
      from: { element: { type: layer } },
      disallow: {
        to: WEB_LAYERS.slice(0, index + 1).map((upper) => ({ element: { type: upper } })),
      },
      message: `${layer} solo importa capas inferiores de apps/web.`,
    })),

    // 6. Guarda contra falsos verdes: un `@repo/*` que no resuelve a su paquete local (por ejemplo,
    //    un `exports` que apunta a un `dist/` sin construir) se clasificaría como externo y pasaría
    //    por la política 1. Va al final para que ninguna otra la anule.
    {
      disallow: { to: { module: { origin: 'external', source: ['@repo/*', '@repo/**'] } } },
      message:
        '{{to.module.source}} no se resolvió a su paquete local: revisa sus "exports" y el tsconfig del paquete.',
    },
  ];
}

/**
 * Configuración de `eslint-plugin-boundaries` para el monorepo.
 *
 * @param {{ rootPath?: string, tsconfigProjects?: string | string[] }} [options]
 *   `rootPath`: raíz desde la que se clasifican los archivos (por defecto, la del repositorio).
 *   `tsconfigProjects`: tsconfig que usa el resolutor de imports (por defecto, el de cada app y paquete).
 * @returns {import('eslint').Linter.Config[]}
 */
export function createBoundariesConfig(options = {}) {
  const rootPath = options.rootPath ?? fileURLToPath(new URL('../../../', import.meta.url));
  const project = options.tsconfigProjects ?? [
    join(rootPath, 'apps/*/tsconfig.json'),
    join(rootPath, 'packages/*/tsconfig.json'),
  ];
  const resolverPath = fileURLToPath(import.meta.resolve('eslint-import-resolver-typescript'));
  // Los tipos del plugin no coinciden exactamente con `ESLint.Plugin` de ESLint 10 (solo tipos).
  const boundariesPlugin = /** @type {import('eslint').ESLint.Plugin} */ (
    /** @type {unknown} */ (boundaries)
  );

  /** @type {import('eslint').Linter.Config[]} */
  const config = [
    {
      name: '@repo/config/boundaries',
      files: ['**/*.{ts,tsx,mts,cts,js,mjs,cjs}'],
      languageOptions: { parser: tseslint.parser },
      plugins: { boundaries: boundariesPlugin },
      settings: {
        'boundaries/root-path': rootPath,
        'boundaries/elements': elementDescriptors(),
        'boundaries/files': [
          { pattern: '**/*.{spec,int-spec,e2e-spec}.{ts,tsx}', category: 'test' },
          { pattern: '**/test/**', category: 'test' },
          // Solo los de la raíz de cada app o paquete: un `*.config.ts` anidado (p. ej. dentro de
          // domain/) no escapa de las restricciones de su capa.
          { pattern: '{apps,packages}/*/*.config.{js,mjs,cjs,ts,mts,cts}', category: 'config' },
        ],
        'import/resolver': {
          [resolverPath]: {
            project,
            alwaysTryTypes: true,
            noWarnOnMultipleProjects: true,
            // Sin `types`: en `exports` va antes que `source` (para TypeScript) y apunta a `dist/`. Así
            // el resolutor elige `source` y las fronteras se resuelven sin compilar `dist/` (ADR-0005).
            conditionNames: ['source', 'import', 'node', 'default'],
          },
        },
      },
      rules: {
        'boundaries/dependencies': [
          'error',
          { checkAllOrigins: true, default: 'disallow', policies: dependencyPolicies() },
        ],
      },
    },
  ];

  return config;
}
