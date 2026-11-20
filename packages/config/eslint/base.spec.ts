import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

import { createBaseConfig, IGNORED_PATHS } from './base.js';

const packageDir = fileURLToPath(new URL('..', import.meta.url));

/**
 * La primera llamada a ESLint de un proceso carga en frío typescript-eslint, TypeScript y los
 * plugins: unos 1,2 s con la máquina tranquila, pero más de 5 s (el límite por defecto de Vitest) en
 * un clon limpio con las tareas de Turbo en paralelo. Ese costo se paga una sola vez, en un
 * calentamiento con su propio límite, y las pruebas de este archivo tienen un límite acotado para
 * absorber la carga de CI. El perfil unitario global no cambia.
 */
const ESLINT_WARMUP_TIMEOUT_MS = 60_000;
const ESLINT_TEST_TIMEOUT_MS = 20_000;

function createEslint(
  fix = false,
  allowSystemTime = false,
  systemClockFiles: readonly string[] = [],
): ESLint {
  return new ESLint({
    cwd: packageDir,
    fix,
    overrideConfigFile: true,
    overrideConfig: createBaseConfig({
      tsconfigRootDir: packageDir,
      allowSystemTime,
      systemClockFiles,
    }),
  });
}

async function systemTimeErrors(source: string, filePath: string, allowSystemTime = false) {
  const [result] = await createEslint(false, allowSystemTime).lintText(source, { filePath });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === 'no-restricted-syntax')
    .map((message) => message.line);
}

beforeAll(async () => {
  // Calentamiento: lint sin tipos (.js) y configuración de un .ts, lo que usan las pruebas.
  await createEslint().lintText('export const warm = 1;\n', { filePath: 'src/warmup.js' });
  await createEslint().calculateConfigForFile('src/warmup.service.ts');
}, ESLINT_WARMUP_TIMEOUT_MS);

const SYSTEM_TIME_SOURCE = [
  'export const a = Date.now();',
  'export const b = new Date();',
  'export const c = Date();',
  'export const d = new Date(0);',
  "export const e = new Date('2026-01-01T00:00:00.000Z');",
  'export const f = Date.parse(e.toISOString());',
].join('\n');

describe('regla de reloj (ADR-0006)', { timeout: ESLINT_TEST_TIMEOUT_MS }, () => {
  it.each([
    'src/charge.js',
    'src/charge.spec.js',
    'test/integration/x.int-spec.js',
    'vitest.config.js',
  ])(
    'prohíbe Date.now(), new Date() y Date() en %s (código, pruebas y configuración)',
    async (filePath) => {
      expect(await systemTimeErrors(SYSTEM_TIME_SOURCE, filePath)).toEqual([1, 2, 3]);
    },
  );

  it('atrapa referencias sin llamar, la forma calculada y globalThis.Date', async () => {
    const source = [
      'export const f = Date.now;',
      "export const g = Date['now']();",
      'export const h = globalThis.Date.now();',
      'export const i = new globalThis.Date();',
      'export const { now } = Date;',
    ].join('\n');
    expect(await systemTimeErrors(source, 'src/evasion.js')).toEqual([1, 2, 3, 4]);
  });

  it('permite construir fechas con argumentos y operar con ellas', async () => {
    const source =
      "export const d = new Date('2026-01-01T00:00:00.000Z');\nexport const t = d.getTime();\n";
    expect(await systemTimeErrors(source, 'src/x.js')).toEqual([]);
  });

  it('allowSystemTime (solo observability) desactiva la regla', async () => {
    expect(await systemTimeErrors(SYSTEM_TIME_SOURCE, 'src/logger.js', true)).toEqual([]);
  });

  it('systemClockFiles exceptúa solo ese archivo (SystemClock, ADR-0011), no a sus vecinos', async () => {
    const files = ['src/clock/infrastructure/system.clock.ts'];
    const ruleFor = async (filePath: string) => {
      const config = (await createEslint(false, false, files).calculateConfigForFile(filePath)) as {
        rules: Record<string, unknown>;
      };
      return severityOf(config.rules['no-restricted-syntax']);
    };

    expect([0, 'off']).toContain(await ruleFor('src/clock/infrastructure/system.clock.ts'));
    for (const neighbour of [
      'src/clock/infrastructure/redis-controllable.clock.ts',
      'src/clock/infrastructure/system.clock.spec.ts',
      'src/clock/clock.module.ts',
      'src/other/infrastructure/system.clock.ts',
    ]) {
      expect([2, 'error']).toContain(await ruleFor(neighbour));
    }
  });

  it('systemClockFiles no admite comodines ni otros archivos', () => {
    for (const file of [
      'src/**/system.clock.ts',
      'src/clock/infrastructure/other.ts',
      'src/clock/infrastructure/evil-system.clock.ts',
      '../other/src/system.clock.ts',
      '/abs/src/system.clock.ts',
      'src\\clock\\system.clock.ts',
      'src/{a,b}/system.clock.ts',
    ]) {
      expect(() =>
        createBaseConfig({ tsconfigRootDir: packageDir, systemClockFiles: [file] }),
      ).toThrow('systemClockFiles solo admite rutas relativas exactas');
    }
  });

  it('permite clases vacías con decorador (módulos de NestJS) y nada más', async () => {
    const config = (await createEslint().calculateConfigForFile('src/app.module.ts')) as {
      rules: Record<string, unknown>;
    };
    const rule = config.rules['@typescript-eslint/no-extraneous-class'] as [unknown, object];
    expect([2, 'error']).toContain(severityOf(rule));
    expect(rule[1]).toEqual({ allowWithDecorator: true });
  });

  it('la regla también aplica a los archivos TypeScript', async () => {
    const config = (await createEslint().calculateConfigForFile('src/charge.service.ts')) as {
      rules: Record<string, unknown>;
    };
    expect([2, 'error']).toContain(severityOf(config.rules['no-restricted-syntax']));
  });
});

function severityOf(rule: unknown): unknown {
  return Array.isArray(rule) ? rule[0] : rule;
}

describe('createBaseConfig', { timeout: ESLINT_TEST_TIMEOUT_MS }, () => {
  it.each([
    'generated/prisma/client.ts',
    'prisma/migrations/0001_init/migration.ts',
    'dist/main.js',
    'coverage/lcov-report/index.js',
  ])('ignora %s', async (path) => {
    await expect(createEslint().isPathIgnored(path)).resolves.toBe(true);
  });

  it('no ignora el código fuente', async () => {
    await expect(createEslint().isPathIgnored('src/charge.service.ts')).resolves.toBe(false);
    expect(IGNORED_PATHS).toEqual(expect.arrayContaining(['**/generated/', '**/migrations/']));
  });

  it('prohíbe any y exige imports ordenados en TypeScript', async () => {
    const config = (await createEslint().calculateConfigForFile('src/charge.service.ts')) as {
      rules: Record<string, unknown>;
    };

    expect([2, 'error']).toContain(severityOf(config.rules['@typescript-eslint/no-explicit-any']));
    expect([2, 'error']).toContain(
      severityOf(config.rules['@typescript-eslint/no-unsafe-assignment']),
    );
    expect([2, 'error']).toContain(severityOf(config.rules['simple-import-sort/imports']));
  });

  it('lintea los archivos .js sin información de tipos', async () => {
    const config = (await createEslint().calculateConfigForFile('eslint.config.js')) as {
      rules: Record<string, unknown>;
    };

    expect([0, 'off']).toContain(
      severityOf(config.rules['@typescript-eslint/no-unsafe-assignment']),
    );
  });

  it('detecta imports desordenados y los corrige con --fix', async () => {
    const source = "import b from 'b';\nimport a from 'a';\n\nexport { a, b };\n";

    const [result] = await createEslint().lintText(source, { filePath: 'fixture.js' });
    expect(result?.messages.map((message) => message.ruleId)).toContain(
      'simple-import-sort/imports',
    );

    const [fixed] = await createEslint(true).lintText(source, { filePath: 'fixture.js' });
    expect(fixed?.output).toBe("import a from 'a';\nimport b from 'b';\n\nexport { a, b };\n");
  });
});
