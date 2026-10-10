import { describe, expect, test } from 'vitest';
import { cmpClosedDesc, cmpEpicOrder, cmpPriorityThenCreated } from './sort.js';

describe('cmpPriorityThenCreated', () => {
  test('orders by priority asc with default 2 for missing', () => {
    const items = [
      { id: 'c', priority: 3 },
      { id: 'a', priority: 1 },
      { id: 'b' },
      { id: 'd', priority: 0 }
    ];
    expect(items.sort(cmpPriorityThenCreated).map((i) => i.id)).toEqual([
      'd',
      'a',
      'b',
      'c'
    ]);
  });

  test('breaks priority ties by created_at asc', () => {
    const a = { id: 'x', priority: 1, created_at: 200 };
    const b = { id: 'y', priority: 1, created_at: 100 };
    expect([a, b].sort(cmpPriorityThenCreated).map((i) => i.id)).toEqual([
      'y',
      'x'
    ]);
  });

  test('breaks remaining ties by id asc for stable order', () => {
    const a = { id: 'bdui-2', priority: 1, created_at: 5 };
    const b = { id: 'bdui-10', priority: 1, created_at: 5 };
    expect(cmpPriorityThenCreated(a, b)).toBe(1);
    expect(cmpPriorityThenCreated(b, a)).toBe(-1);
    expect(cmpPriorityThenCreated(a, a)).toBe(0);
  });
});

describe('cmpEpicOrder', () => {
  test('ranks in_progress before open before closed, then by priority', () => {
    /** @type {import('./sort.js').IssueLite[]} */
    const items = [
      { id: 'closed', status: 'closed', priority: 0 },
      { id: 'open', status: 'open', priority: 2 },
      { id: 'prog', status: 'in_progress', priority: 3 },
      { id: 'undef' }
    ];
    expect(items.sort(cmpEpicOrder).map((i) => i.id)).toEqual([
      'prog',
      'open',
      'undef',
      'closed'
    ]);
  });
});

describe('cmpClosedDesc', () => {
  test('orders by closed_at desc, missing treated as 0', () => {
    const items = [
      { id: 'old', closed_at: 100 },
      { id: 'recent', closed_at: 900 },
      { id: 'never' }
    ];
    expect(items.sort(cmpClosedDesc).map((i) => i.id)).toEqual([
      'recent',
      'old',
      'never'
    ]);
  });

  test('breaks closed_at ties by id asc for stability', () => {
    const a = { id: 'bdui-2', closed_at: 50 };
    const b = { id: 'bdui-10', closed_at: 50 };
    expect(cmpClosedDesc(a, b)).toBe(1);
    expect(cmpClosedDesc(b, a)).toBe(-1);
    expect(cmpClosedDesc(a, a)).toBe(0);
  });
});
