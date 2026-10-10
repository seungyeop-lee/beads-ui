import { describe, expect, test } from 'vitest';
import { keyOf } from './subscription-key.js';

describe('subscription key', () => {
  test('sorts params for stable keys', () => {
    const a = keyOf({ type: 'list', params: { status: 'open', limit: 50 } });
    const b = keyOf({ type: 'list', params: { limit: 50, status: 'open' } });
    expect(a).toBe('list?limit=50&status=open');
    expect(b).toBe('list?limit=50&status=open');
  });

  test('returns bare type when there are no params', () => {
    expect(keyOf({ type: 'all-issues' })).toBe('all-issues');
    expect(keyOf({ type: 'all-issues', params: {} })).toBe('all-issues');
  });

  test('stringifies non-string param values', () => {
    const key = keyOf({
      type: 'closed-issues',
      params: { since: 1717, open: false }
    });
    expect(key).toBe('closed-issues?open=false&since=1717');
  });
});
