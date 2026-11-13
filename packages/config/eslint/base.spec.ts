import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

import { createBaseConfig, IGNORED_PATHS } from './base.js';

const packageDir = fileURLToPath(new URL('..', import.meta.url));

function createEslint(fix = false): ESLint {
  return new ESLint({
    cwd: packageDir,
    fix,
    overrideConfigFile: true,
    overrideConfig: createBaseConfig({ tsconfigRootDir: packageDir }),
  });
}

function severityOf(rule: unknown): unknown {
  return Array.isArray(rule) ? rule[0] : rule;
}

describe('createBaseConfig', () => {
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
