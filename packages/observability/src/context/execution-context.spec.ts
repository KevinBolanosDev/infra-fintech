import { setTimeout as sleep } from 'node:timers/promises';

import { describe, expect, it } from 'vitest';

import { ExecutionContext, executionContext } from './execution-context.js';

const storeA = { requestId: 'req-a', correlationId: 'corr-a' };
const storeB = { requestId: 'req-b', correlationId: 'corr-b', actorId: 'user-1', ip: '127.0.0.1' };

describe('ExecutionContext', () => {
  it('no tiene contexto fuera de un run', () => {
    expect(new ExecutionContext().get()).toBeUndefined();
  });

  it('expone el contexto dentro de run y devuelve el resultado de la función', () => {
    const context = new ExecutionContext();
    const result = context.run(storeB, () => context.get());
    expect(result).toEqual(storeB);
    expect(context.get()).toBeUndefined();
  });

  it('el contexto sobrevive a las esperas asíncronas', async () => {
    const context = new ExecutionContext();
    const seen = await context.run(storeA, async () => {
      await sleep(5);
      return context.get()?.requestId;
    });
    expect(seen).toBe('req-a');
  });

  it('no mezcla el contexto de dos ejecuciones concurrentes', async () => {
    const context = new ExecutionContext();
    const observe = (store: typeof storeA, delays: number[]): Promise<string[]> =>
      context.run(store, async () => {
        const seen: string[] = [];
        for (const delay of delays) {
          await sleep(delay);
          seen.push(context.get()?.requestId ?? 'sin contexto');
        }
        return seen;
      });

    const [a, b] = await Promise.all([observe(storeA, [5, 1, 5]), observe(storeB, [1, 5, 1])]);

    expect(a).toEqual(['req-a', 'req-a', 'req-a']);
    expect(b).toEqual(['req-b', 'req-b', 'req-b']);
  });

  it('un run anidado reemplaza el contexto solo dentro de su función', () => {
    const context = new ExecutionContext();
    context.run(storeA, () => {
      expect(context.run(storeB, () => context.get()?.requestId)).toBe('req-b');
      expect(context.get()?.requestId).toBe('req-a');
    });
  });

  it('exporta un contexto compartido por el proceso', () => {
    expect(executionContext).toBeInstanceOf(ExecutionContext);
  });
});
