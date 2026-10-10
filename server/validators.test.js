import { describe, expect, test } from 'vitest';
import { validateSubscribeListPayload } from './validators.js';

describe('validateSubscribeListPayload', () => {
  test('rejects non-object payloads', () => {
    const res = validateSubscribeListPayload(null);
    expect(res).toEqual({
      ok: false,
      code: 'bad_request',
      message: 'payload must be an object'
    });
  });

  test('rejects missing or empty id', () => {
    for (const payload of [
      { type: 'all-issues' },
      { id: '', type: 'all-issues' }
    ]) {
      const res = validateSubscribeListPayload(payload);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toBe('payload.id must be a non-empty string');
      }
    }
  });

  test('rejects unknown subscription type', () => {
    const res = validateSubscribeListPayload({ id: 's1', type: 'nope' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toContain('payload.type must be one of:');
      expect(res.message).toContain('all-issues');
    }
  });

  test('accepts a plain type and strips params', () => {
    const res = validateSubscribeListPayload({
      id: 's1',
      type: 'all-issues',
      params: {}
    });
    expect(res).toEqual({ ok: true, id: 's1', spec: { type: 'all-issues' } });
  });

  test('rejects params that are not objects', () => {
    const res = validateSubscribeListPayload({
      id: 's1',
      type: 'all-issues',
      params: ['x']
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toBe(
        'payload.params must be an object when provided'
      );
    }
  });

  test('issue-detail normalizes params.id and requires it', () => {
    const missing = validateSubscribeListPayload({
      id: 's1',
      type: 'issue-detail'
    });
    expect(missing.ok).toBe(false);

    const ok = validateSubscribeListPayload({
      id: 's1',
      type: 'epic-children',
      params: { id: '  bdui-1  ' }
    });
    expect(ok).toEqual({
      ok: true,
      id: 's1',
      spec: { type: 'epic-children', params: { id: 'bdui-1' } }
    });
  });

  test('closed-issues validates since as non-negative epoch ms', () => {
    const bad = validateSubscribeListPayload({
      id: 's1',
      type: 'closed-issues',
      params: { since: -1 }
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.message).toBe(
        'params.since must be a non-negative number (epoch ms)'
      );
    }

    const ok = validateSubscribeListPayload({
      id: 's1',
      type: 'closed-issues',
      params: { since: 1717 }
    });
    expect(ok).toEqual({
      ok: true,
      id: 's1',
      spec: { type: 'closed-issues', params: { since: 1717 } }
    });

    const bare = validateSubscribeListPayload({
      id: 's1',
      type: 'closed-issues'
    });
    expect(bare).toEqual({
      ok: true,
      id: 's1',
      spec: { type: 'closed-issues' }
    });
  });

  test('filtered-issues normalizes statuses and rejects invalid tokens', () => {
    const bad_type = validateSubscribeListPayload({
      id: 's1',
      type: 'filtered-issues',
      params: { statuses: 5 }
    });
    expect(bad_type.ok).toBe(false);
    if (!bad_type.ok) {
      expect(bad_type.message).toBe(
        'params.statuses must be a comma-separated string'
      );
    }

    const bad_token = validateSubscribeListPayload({
      id: 's1',
      type: 'filtered-issues',
      params: { statuses: 'open, nope' }
    });
    expect(bad_token.ok).toBe(false);
    if (!bad_token.ok) {
      expect(bad_token.message).toBe(
        'params.statuses contains invalid value: nope'
      );
    }

    const ok = validateSubscribeListPayload({
      id: 's1',
      type: 'filtered-issues',
      params: { statuses: ' open , closed ' }
    });
    expect(ok).toEqual({
      ok: true,
      id: 's1',
      spec: { type: 'filtered-issues', params: { statuses: 'open,closed' } }
    });

    const empty = validateSubscribeListPayload({
      id: 's1',
      type: 'filtered-issues',
      params: { statuses: ' , ' }
    });
    expect(empty).toEqual({
      ok: true,
      id: 's1',
      spec: { type: 'filtered-issues' }
    });
  });

  test('rejects params for types that do not accept them', () => {
    const res = validateSubscribeListPayload({
      id: 's1',
      type: 'all-issues',
      params: { extra: 1 }
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toBe('type all-issues does not accept params');
    }
  });
});
