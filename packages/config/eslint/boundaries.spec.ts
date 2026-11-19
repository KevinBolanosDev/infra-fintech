import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

import { ALLOWED_INTERNAL, APPS, createBoundariesConfig, PACKAGES } from './boundaries.js';

const FIXTURE = fileURLToPath(new URL('./__fixtures__/boundaries/', import.meta.url));

const eslint = new ESLint({
  cwd: FIXTURE,
  overrideConfigFile: true,
  overrideConfig: createBoundariesConfig({
    rootPath: FIXTURE,
    tsconfigProjects: join(FIXTURE, 'tsconfig.json'),
  }),
});

type ImportKind = 'value' | 'type' | 'inline-type' | 'export-type';

/** Edge: [archivo que importa, especificador, tipo de import]. */
type Edge = readonly [from: string, specifier: string, kind?: ImportKind];

const API = 'apps/api/src/main.ts';
const WORKER = 'apps/worker/src/main.ts';
const PROVIDER_SIM = 'apps/provider-sim/src/main.ts';
const WEB_APP = 'apps/web/app/page.ts';
const pkg = (name: string): string => `packages/${name}/src/index.ts`;
const charges = (layer: string): string => `apps/api/src/modules/charges/${layer}/index.ts`;
const clock = (layer: string): string => `packages/platform/src/clock/${layer}/index.ts`;
const web = (layer: string, slice?: string): string =>
  slice === undefined
    ? `apps/web/src/${layer}/index.ts`
    : `apps/web/src/${layer}/${slice}/index.ts`;

/** Desde `packages/<x>/src/index.ts` hasta el `main.ts` de una app. */
const toApp = (app: string): string => `../../../apps/${app}/src/main.js`;

async function dependencyErrors([from, specifier, kind = 'value']: Edge): Promise<string[]> {
  const code = {
    value: `import { value } from '${specifier}';\n\nexport const used = value;\n`,
    type: `import type { value } from '${specifier}';\n\nexport type Value = typeof value;\n`,
    'inline-type': `import { type value } from '${specifier}';\n\nexport type Value = typeof value;\n`,
    'export-type': `export type { value } from '${specifier}';\n`,
  }[kind];
  const [result] = await eslint.lintText(code, { filePath: join(FIXTURE, from) });
  if (result === undefined) {
    throw new Error(`ESLint no devolvió resultado para ${from}`);
  }

  const fatal = result.messages.filter((message) => message.fatal === true);
  expect(fatal).toEqual([]);

  return result.messages
    .filter((message) => message.ruleId === 'boundaries/dependencies')
    .map((message) => message.message);
}

interface EdgeCase {
  readonly from: string;
  readonly specifier: string;
  readonly kind: ImportKind;
}

function asCases(edges: readonly Edge[]): EdgeCase[] {
  return edges.map(([from, specifier, kind = 'value']) => ({ from, specifier, kind }));
}

const FORBIDDEN: Record<string, readonly Edge[]> = {
  'sección 1: domain no importa nada externo ni proveedores': [
    [pkg('domain'), '@nestjs/common'],
    [pkg('domain'), '@prisma/client'],
    [pkg('domain'), 'node:http'],
    [pkg('domain'), '@repo/integrations'],
    [pkg('domain'), '@repo/contracts'],
  ],
  'sección 1: contracts solo importa zod': [
    [pkg('contracts'), '@repo/domain'],
    [pkg('contracts'), '@repo/db'],
    [pkg('contracts'), 'lodash'],
  ],
  'sección 1: db no importa integrations ni apps, y domain solo como tipo': [
    [pkg('db'), '@repo/integrations'],
    [pkg('db'), toApp('api')],
    [pkg('db'), '@repo/domain', 'value'],
  ],
  'sección 1: integrations no importa db ni apps': [
    [pkg('integrations'), '@repo/db'],
    [pkg('integrations'), toApp('worker')],
  ],
  'sección 1: api y worker no importan web, ui ni otra app': [
    [API, '../../web/app/page.js'],
    [API, '@repo/ui'],
    [API, '../../worker/src/main.js'],
    [WORKER, '../../web/app/page.js'],
    [WORKER, '@repo/ui'],
    [WORKER, '../../api/src/main.js'],
  ],
  'sección 1: provider-sim no importa db ni otra app': [
    [PROVIDER_SIM, '@repo/db'],
    [PROVIDER_SIM, '../../api/src/main.js'],
  ],
  'sección 1: web no importa db ni integrations': [
    [WEB_APP, '@repo/db'],
    [WEB_APP, '@repo/integrations'],
    [WEB_APP, '../../api/src/main.js'],
  ],
  'D-07: observability, config, testing, platform, api-client y ui': [
    [pkg('observability'), '@repo/domain'],
    [pkg('observability'), '@repo/db'],
    [pkg('observability'), '@nestjs/common'],
    [pkg('observability'), 'lodash'],
    [pkg('observability'), toApp('api')],
    [pkg('config'), '@repo/domain'],
    [pkg('testing'), toApp('api')],
    [pkg('platform'), toApp('api')],
    [pkg('platform'), '../../../apps/web/app/page.js'],
    [pkg('platform'), '@repo/ui'],
    [pkg('platform'), '@repo/integrations'],
    [pkg('api-client'), '@repo/domain'],
    [pkg('ui'), '@repo/domain'],
  ],
  'testing solo desde archivos de prueba': [
    [API, '@repo/testing'],
    [charges('application'), '@repo/testing'],
  ],
  'config solo desde archivos de configuración': [
    [API, '@repo/config'],
    [pkg('domain'), '@repo/config'],
    [charges('application'), '@repo/config'],
  ],
  'testing solo desde pruebas de api, worker y platform': [
    ['packages/domain/src/money.spec.ts', '@repo/testing'],
    ['packages/observability/src/logger.spec.ts', '@repo/testing'],
    ['packages/contracts/src/schema.spec.ts', '@repo/testing'],
  ],
  'pruebas y configuración siguen sujetas a las reglas internas': [
    ['packages/domain/src/money.spec.ts', '@repo/integrations'],
    ['packages/contracts/src/schema.spec.ts', '@repo/db'],
    ['packages/domain/vitest.config.ts', '@repo/platform'],
    ['packages/domain/src/money.spec.ts', '@prisma/client'],
  ],
  'domain/ de un módulo es lista cerrada': [
    [charges('domain'), '@repo/integrations'],
    [charges('domain'), '@repo/platform'],
    [charges('domain'), '@repo/observability'],
    [charges('domain'), '@repo/contracts'],
    [charges('domain'), 'zod'],
    [charges('domain'), 'node:http'],
    [charges('domain'), '../../leases/domain/index.js'],
    [charges('domain'), '../../../main.js'],
    [clock('domain'), '@repo/observability'],
  ],
  'subrutas de @repo y Prisma, config anidado y FSD desde infrastructure/ en web': [
    [API, '@repo/config/eslint/base'],
    ['apps/api/vitest.config.ts', '@repo/config/no-existe'],
    [charges('application'), '@prisma/client/sql'],
    [charges('interface'), '@prisma/client/runtime/client'],
    [charges('application'), 'prisma/config'],
    [charges('application'), 'prisma'],
    ['apps/api/src/modules/charges/domain/app.config.ts', 'zod'],
    ['apps/api/src/modules/charges/domain/app.config.ts', '@repo/config'],
    ['apps/web/src/shared/api/infrastructure/index.ts', '../../../features/alpha/index.js'],
  ],
  'pruebas y configuración siguen sujetas a Prisma y a las reglas internas': [
    ['apps/api/test/integration/charges.int-spec.ts', '@prisma/client'],
    ['apps/api/test/integration/charges.int-spec.ts', '@repo/db'],
    ['apps/api/vitest.config.ts', '@prisma/client'],
    ['apps/api/vitest.config.ts', '@repo/testing'],
    ['apps/api/src/modules/charges/application/create-charge.spec.ts', '@repo/db'],
    ['packages/ui/src/view.spec.ts', '@repo/testing'],
    ['packages/integrations/src/adapter.spec.ts', '@repo/testing'],
    ['apps/provider-sim/src/main.spec.ts', '@repo/testing'],
    ['apps/web/src/shared/format.spec.ts', '@repo/testing'],
    [charges('domain'), '@repo/db'],
    // Limitación conocida del plugin: `import { type X }` cuenta como import de valor. En
    // packages/db hay que usar `import type { X }` (falso bloqueo, nunca falso permiso).
    [pkg('db'), '@repo/domain', 'inline-type'],
    // Decisión del usuario (ADR-0003): las pruebas dentro de domain/ no usan @repo/testing.
    ['apps/api/src/modules/charges/domain/charge.spec.ts', '@repo/testing'],
  ],
  'sección 2: capas hexagonales': [
    [charges('domain'), '../application/index.js'],
    [charges('domain'), '../infrastructure/index.js'],
    [charges('domain'), '../interface/index.js'],
    [charges('domain'), '@nestjs/common'],
    [charges('application'), '../infrastructure/index.js'],
    [charges('application'), '../interface/index.js'],
    [charges('infrastructure'), '../interface/index.js'],
    [charges('interface'), '../infrastructure/index.js'],
    [clock('application'), '../infrastructure/index.js'],
  ],
  'Prisma solo en infrastructure/ y packages/db': [
    [charges('domain'), '@prisma/client'],
    [charges('application'), '@prisma/client'],
    [charges('application'), '@repo/db'],
    [charges('interface'), '@prisma/client'],
    [charges('interface'), '@repo/db'],
    [API, '@prisma/client'],
    [API, '@repo/db'],
    [clock('application'), '@repo/db'],
    [pkg('platform'), '@prisma/client'],
  ],
  'Prisma y db no se reabren a quien nunca puede usarlos aunque tenga infrastructure/': [
    ['apps/provider-sim/src/payments/infrastructure/index.ts', '@repo/db'],
    ['apps/provider-sim/src/payments/infrastructure/index.ts', '@prisma/client'],
    ['apps/web/src/shared/api/infrastructure/index.ts', '@repo/db'],
    ...['integrations', 'domain', 'contracts', 'observability', 'ui', 'api-client'].flatMap(
      (name): Edge[] => [
        [`packages/${name}/src/sample/infrastructure/index.ts`, '@repo/db'],
        [`packages/${name}/src/sample/infrastructure/index.ts`, '@prisma/client'],
      ],
    ),
  ],
  'celdas "Nunca importa" de api-client, ui y config, y pares de apps': [
    [pkg('api-client'), '@repo/db'],
    [pkg('api-client'), '@repo/integrations'],
    [pkg('api-client'), toApp('api')],
    [pkg('ui'), toApp('api')],
    [pkg('ui'), '@repo/contracts'],
    [pkg('config'), toApp('worker')],
    [PROVIDER_SIM, '../../worker/src/main.js'],
    [WEB_APP, '../../worker/src/main.js'],
    [WEB_APP, '../../provider-sim/src/main.js'],
    [API, '../../provider-sim/src/main.js'],
  ],
  'archivos anidados dentro de capas y slices': [
    [
      'apps/api/src/modules/charges/application/use-cases/create-charge.ts',
      '../../infrastructure/index.js',
    ],
    ['apps/api/src/modules/charges/application/use-cases/create-charge.ts', '@prisma/client'],
    ['apps/web/src/features/alpha/ui/button.ts', '../../../widgets/alpha/index.js'],
    ['apps/web/src/features/alpha/ui/button.ts', '../../beta/index.js'],
  ],
  'sección 3: FSD, solo capas inferiores y sin slices hermanos': [
    [web('core'), '../../app/page.js'],
    [web('views', 'alpha'), '../../core/index.js'],
    [web('widgets', 'alpha'), '../../views/alpha/index.js'],
    [web('features', 'alpha'), '../../widgets/alpha/index.js'],
    [web('entities', 'alpha'), '../../features/alpha/index.js'],
    [web('shared'), '../entities/alpha/index.js'],
    [web('views', 'alpha'), '../beta/index.js'],
    [web('widgets', 'alpha'), '../beta/index.js'],
    [web('features', 'alpha'), '../beta/index.js'],
    [web('entities', 'alpha'), '../beta/index.js'],
  ],
};

const ALLOWED: Record<string, readonly Edge[]> = {
  'sección 1': [
    [pkg('contracts'), 'zod'],
    [pkg('db'), '@prisma/client'],
    [pkg('db'), '@repo/domain', 'type'],
    [pkg('integrations'), '@repo/domain'],
    [pkg('integrations'), '@repo/contracts'],
    [API, '@repo/domain'],
    [API, '@repo/contracts'],
    [API, '@repo/integrations'],
    [API, '@repo/observability'],
    [API, '@repo/platform'],
    [API, '@nestjs/common'],
    [WORKER, '@repo/platform'],
    [WORKER, '@repo/integrations'],
    [PROVIDER_SIM, '@repo/contracts'],
    [PROVIDER_SIM, '@repo/integrations'],
    [WEB_APP, '@repo/contracts'],
    [WEB_APP, '@repo/api-client'],
    [WEB_APP, '@repo/ui'],
    [WEB_APP, '@repo/domain'],
  ],
  'D-07': [
    [pkg('observability'), 'pino'],
    [pkg('observability'), 'pino-pretty'],
    [pkg('observability'), '@opentelemetry/api'],
    [pkg('observability'), '@sentry/node'],
    [pkg('observability'), 'node:async_hooks'],
    [pkg('testing'), '@repo/domain'],
    [pkg('testing'), '@repo/contracts'],
    [pkg('testing'), '@repo/db'],
    [pkg('testing'), '@repo/platform'],
    [pkg('platform'), '@repo/domain'],
    [pkg('platform'), '@repo/contracts'],
    [pkg('platform'), '@repo/observability'],
    [pkg('platform'), '@nestjs/common'],
    [clock('infrastructure'), '@repo/db'],
    [pkg('api-client'), '@repo/contracts'],
  ],
  'config desde archivos de configuración': [
    ['apps/api/vitest.config.ts', '@repo/config'],
    ['packages/domain/vitest.config.ts', '@repo/config'],
    ['packages/contracts/eslint.config.js', '@repo/config'],
  ],
  'pruebas y configuración importan herramientas externas': [
    ['packages/domain/src/money.spec.ts', 'vitest'],
    ['packages/domain/src/money.spec.ts', 'fast-check'],
    ['packages/domain/vitest.config.ts', 'vitest/config'],
    ['packages/contracts/src/schema.spec.ts', 'vitest'],
    ['packages/contracts/eslint.config.js', 'eslint/config'],
    ['packages/observability/src/logger.spec.ts', 'vitest'],
    ['apps/api/src/modules/charges/domain/charge.spec.ts', 'vitest'],
  ],
  'domain/ importa @repo/domain e interface/ importa valores de domain/': [
    [charges('domain'), '@repo/domain'],
    [clock('domain'), '@repo/domain'],
    [charges('interface'), '../domain/index.js'],
  ],
  'subrutas, hermanos dentro de una capa o slice e imports de solo tipos': [
    ['apps/api/vitest.config.ts', '@repo/config/eslint/base'],
    [charges('domain'), './money.js'],
    ['apps/api/src/modules/charges/domain/entities/charge.ts', '../index.js'],
    ['apps/web/src/features/alpha/ui/button.ts', '../index.js'],
    [web('shared'), './api/infrastructure/index.js'],
    [pkg('db'), '@repo/domain', 'export-type'],
    ['packages/db/prisma.config.ts', 'prisma/config'],
    // prisma.config.ts vive en la raíz (D-12 = a, ADR-0009): fuera de todo paquete, sin reglas.
    ['prisma.config.ts', 'prisma/config'],
    [charges('infrastructure'), '@prisma/client/sql'],
  ],
  'testing desde pruebas': [
    ['packages/platform/src/clock/application/clock.spec.ts', '@repo/testing'],
    ['apps/worker/test/integration/jobs.int-spec.ts', '@repo/testing'],
    ['apps/api/src/modules/charges/application/create-charge.spec.ts', '@repo/testing'],
    ['apps/api/test/integration/charges.int-spec.ts', '@repo/testing'],
  ],
  'sección 2 y Prisma en infrastructure/': [
    [charges('application'), '../domain/index.js'],
    [charges('infrastructure'), '../domain/index.js'],
    [charges('infrastructure'), '../application/index.js'],
    [charges('infrastructure'), '@prisma/client'],
    [charges('infrastructure'), '@repo/db'],
    [charges('interface'), '../application/index.js'],
    [charges('interface'), '../domain/index.js'],
    [charges('interface'), '@nestjs/common'],
    [API, './modules/charges/interface/index.js'],
  ],
  'archivos anidados': [
    [
      'apps/api/src/modules/charges/application/use-cases/create-charge.ts',
      '../../domain/index.js',
    ],
    ['apps/web/src/features/alpha/ui/button.ts', '../../../entities/alpha/index.js'],
  ],
  'sección 3: FSD hacia abajo': [
    [WEB_APP, '../src/core/index.js'],
    [WEB_APP, '../src/views/alpha/index.js'],
    [WEB_APP, '../src/shared/index.js'],
    [web('core'), '../views/alpha/index.js'],
    [web('views', 'alpha'), '../../widgets/alpha/index.js'],
    [web('widgets', 'alpha'), '../../features/alpha/index.js'],
    [web('features', 'alpha'), '../../entities/alpha/index.js'],
    [web('entities', 'alpha'), '../../shared/index.js'],
    [web('shared'), '@repo/ui'],
    [web('shared'), '@repo/api-client'],
  ],
};

describe('createBoundariesConfig', () => {
  // Guarda: el plugin captura los errores de sus propios selectores (por ejemplo, un `to: []`
  // vacío) y la política rota simplemente no se evalúa, sin que ninguna prueba lo note.
  it('ninguna política tiene listas de selectores vacías ni selectores vacíos', () => {
    const [config] = createBoundariesConfig();
    const rule = config?.rules?.['boundaries/dependencies'] as [string, { policies: object[] }];
    const problems: string[] = [];

    const check = (value: unknown, path: string): void => {
      if (Array.isArray(value)) {
        if (value.length === 0) problems.push(`${path} es una lista vacía`);
        value.forEach((item, index) => {
          check(item, `${path}[${String(index)}]`);
        });
      } else if (typeof value === 'object' && value !== null) {
        if (Object.keys(value).length === 0) problems.push(`${path} es un selector vacío`);
        for (const [key, child] of Object.entries(value)) check(child, `${path}.${key}`);
      }
    };
    rule[1].policies.forEach((policy, index) => {
      check(policy, `policies[${String(index)}]`);
    });

    expect(problems).toEqual([]);
  });

  for (const [group, edges] of Object.entries(FORBIDDEN)) {
    describe(`prohíbe — ${group}`, () => {
      it.each(asCases(edges))('$from → $specifier ($kind)', async ({ from, specifier, kind }) => {
        expect(await dependencyErrors([from, specifier, kind])).not.toEqual([]);
      });
    });
  }

  for (const [group, edges] of Object.entries(ALLOWED)) {
    describe(`permite — ${group}`, () => {
      it.each(asCases(edges))('$from → $specifier ($kind)', async ({ from, specifier, kind }) => {
        expect(await dependencyErrors([from, specifier, kind])).toEqual([]);
      });
    });
  }

  // Guarda contra falsos verdes: si un `@repo/*` no se resolviera a su archivo local, el plugin lo
  // trataría como módulo externo (permitido) y las pruebas de "permite" pasarían sin comprobar nada.
  // `ui` (desde un archivo que no es de configuración) acepta cualquier módulo externo pero ningún
  // paquete interno, ni siquiera `config`: solo da error si el import resuelve a un archivo local.
  it.each(PACKAGES.filter((name) => name !== 'ui'))(
    'resuelve @repo/%s como elemento local (ui no puede importarlo)',
    async (name) => {
      expect(await dependencyErrors([pkg('ui'), `@repo/${name}`])).not.toEqual([]);
    },
  );

  it('un @repo/* que no resuelve a su paquete local es un error, no un módulo externo', async () => {
    const errors = await dependencyErrors([API, '@repo/no-existe']);
    expect(errors.join('\n')).toContain('no se resolvió a su paquete local');
  });

  it('trata como externo un paquete que no es del monorepo (ui sí puede importarlo)', async () => {
    expect(await dependencyErrors([pkg('ui'), '@acme/no-existe'])).toEqual([]);
  });

  it.each(['api', 'worker', 'provider-sim'])(
    'resuelve la app %s como elemento local (ningún paquete puede importarla)',
    async (app) => {
      expect(await dependencyErrors([pkg('platform'), toApp(app)])).not.toEqual([]);
    },
  );

  it('APPS y PACKAGES coinciden con las carpetas reales de apps/ y packages/ ', () => {
    const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
    const folders = (dir: string): string[] =>
      readdirSync(join(repoRoot, dir), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();

    expect(folders('apps')).toEqual([...APPS].sort());
    expect(folders('packages')).toEqual([...PACKAGES].sort());
  });

  it('declara reglas para todas las apps y paquetes del monorepo', () => {
    expect(Object.keys(ALLOWED_INTERNAL).sort()).toEqual([...APPS, ...PACKAGES].sort());
  });

  it('una app nunca figura como dependencia permitida de nadie', () => {
    const allowedTargets = Object.values(ALLOWED_INTERNAL).flat();
    for (const app of APPS) {
      expect(allowedTargets).not.toContain(app);
    }
  });

  it('usa por defecto la raíz del repositorio y los tsconfig de apps y paquetes', () => {
    const [config] = createBoundariesConfig();
    const settings = config?.settings as Record<string, unknown>;
    const rootPath = settings['boundaries/root-path'];

    expect(rootPath).toBe(fileURLToPath(new URL('../../../', import.meta.url)));
    expect(JSON.stringify(settings['import/resolver'])).toContain('/packages/*/tsconfig.json');
    // Condición `source` primero: los paquetes compilados se resuelven sin dist/ (ADR-0005).
    expect(JSON.stringify(settings['import/resolver'])).toContain('"conditionNames":["source"');
  });
});
