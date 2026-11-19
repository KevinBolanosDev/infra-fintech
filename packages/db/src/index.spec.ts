import { describe, expect, it } from 'vitest';

import * as db from './index.js';

describe('@repo/db', () => {
  it('expone la fábrica del cliente y los valores del cliente generado', () => {
    expect(typeof db.createPrismaClient).toBe('function');
    expect(typeof db.PrismaClient).toBe('function');
    expect(typeof db.Prisma).toBe('object');
  });
});
