import { describe, expect, it } from 'vitest';

import * as testing from './index.js';

describe('@repo/testing', () => {
  it('expone el harness', () => {
    for (const name of [
      'startPostgres',
      'startRedis',
      'migrateDatabase',
      'assertHarnessDatabaseUrl',
      'resetDatabase',
      'resetRedis',
      'buildTruncateStatement',
      'harnessUrls',
      'createTestPrismaClient',
      'ManualClock',
    ] as const) {
      expect(typeof testing[name]).toBe('function');
    }
    expect(testing.POSTGRES_IMAGE).toContain('@sha256:');
  });
});
