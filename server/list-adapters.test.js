import { beforeEach, describe, expect, test, vi } from 'vitest';
import { runBdJson } from './bd.js';
import {
  fetchListForSubscription,
  mapSubscriptionToBdArgs
} from './list-adapters.js';

vi.mock('./bd.js', () => ({ runBdJson: vi.fn() }));

describe('list adapters for subscription types', () => {
  beforeEach(() => {
    /** @type {import('vitest').Mock} */ (runBdJson).mockReset();
  });

  test('mapSubscriptionToBdArgs returns args for all-issues', () => {
    const args = mapSubscriptionToBdArgs({ type: 'all-issues' });
    expect(args).toEqual(['list', '--json', '--tree=false']);
  });

  test('mapSubscriptionToBdArgs returns args for epics', () => {
    const args = mapSubscriptionToBdArgs({ type: 'epics' });
    expect(args).toEqual(['epic', 'status', '--json']);
  });

  test('mapSubscriptionToBdArgs returns args for blocked-issues', () => {
    const args = mapSubscriptionToBdArgs({ type: 'blocked-issues' });
    // We choose dedicated subcommand mapping for blocked
    expect(args).toEqual(['blocked', '--json']);
  });

  test('mapSubscriptionToBdArgs returns args for ready-issues', () => {
    const args = mapSubscriptionToBdArgs({ type: 'ready-issues' });
    expect(args).toEqual(['ready', '--limit', '1000', '--json']);
  });

  test('mapSubscriptionToBdArgs returns args for in-progress-issues', () => {
    const args = mapSubscriptionToBdArgs({ type: 'in-progress-issues' });
    expect(args).toEqual([
      'list',
      '--json',
      '--tree=false',
      '--status',
      'in_progress'
    ]);
  });

  test('mapSubscriptionToBdArgs returns args for closed-issues', () => {
    const args = mapSubscriptionToBdArgs({ type: 'closed-issues' });
    expect(args).toEqual([
      'list',
      '--json',
      '--tree=false',
      '--status',
      'closed',
      '--limit',
      '1000'
    ]);
  });

  test('mapSubscriptionToBdArgs returns CSV --status args for filtered-issues', () => {
    const args = mapSubscriptionToBdArgs({
      type: 'filtered-issues',
      params: { statuses: 'open,closed' }
    });
    expect(args).toEqual([
      'list',
      '--json',
      '--tree=false',
      '--status',
      'open,closed',
      '--limit',
      '1000'
    ]);
  });

  test('mapSubscriptionToBdArgs trims whitespace in filtered-issues statuses', () => {
    const args = mapSubscriptionToBdArgs({
      type: 'filtered-issues',
      params: { statuses: ' in_progress , closed ' }
    });
    expect(args).toEqual([
      'list',
      '--json',
      '--tree=false',
      '--status',
      'in_progress,closed',
      '--limit',
      '1000'
    ]);
  });

  test('mapSubscriptionToBdArgs expands missing filtered-issues statuses to all three', () => {
    const args = mapSubscriptionToBdArgs({ type: 'filtered-issues' });
    expect(args).toEqual([
      'list',
      '--json',
      '--tree=false',
      '--status',
      'open,in_progress,closed',
      '--limit',
      '1000'
    ]);
  });

  test('mapSubscriptionToBdArgs expands empty filtered-issues statuses to all three', () => {
    const args = mapSubscriptionToBdArgs({
      type: 'filtered-issues',
      params: { statuses: '' }
    });
    expect(args).toEqual([
      'list',
      '--json',
      '--tree=false',
      '--status',
      'open,in_progress,closed',
      '--limit',
      '1000'
    ]);
  });

  test('mapSubscriptionToBdArgs returns args for issue-detail', () => {
    const args = mapSubscriptionToBdArgs({
      type: 'issue-detail',
      params: { id: 'UI-123' }
    });
    expect(args).toEqual(['show', 'UI-123', '--json']);
  });

  test('fetchListForSubscription returns normalized items (Date.parse)', async () => {
    /** @type {import('vitest').Mock} */ (runBdJson).mockResolvedValue({
      code: 0,
      stdoutJson: [
        {
          id: 'A-1',
          updated_at: '2024-01-01T00:00:00.000Z',
          closed_at: null,
          extra: 'x'
        },
        {
          id: 'A-2',
          updated_at: '2024-01-01T00:00:01.000Z',
          closed_at: '2024-01-01T00:00:05.000Z'
        },
        { id: 3, updated_at: 'not-a-date' }
      ]
    });
    const res = await fetchListForSubscription({ type: 'all-issues' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.items.length).toBe(3);
      expect(res.items[0]).toMatchObject({
        id: 'A-1',
        updated_at: Date.parse('2024-01-01T00:00:00.000Z'),
        closed_at: null
      });
      expect(res.items[1]).toMatchObject({
        id: 'A-2',
        updated_at: Date.parse('2024-01-01T00:00:01.000Z'),
        closed_at: Date.parse('2024-01-01T00:00:05.000Z')
      });
      // id coerced to string, closed_at defaults to null
      expect(res.items[2]).toMatchObject({
        id: '3',
        updated_at: 0,
        closed_at: null
      });
    }
  });

  test('filters tombstoned epics', async () => {
    /** @type {import('vitest').Mock} */ (runBdJson).mockResolvedValue({
      code: 0,
      stdoutJson: [
        {
          epic: {
            id: 'E-1',
            status: 'open',
            issue_type: 'epic',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
            closed_at: null
          },
          total_children: 1,
          closed_children: 0,
          eligible_for_close: false
        },
        {
          epic: {
            id: 'E-2',
            status: 'tombstone',
            issue_type: 'epic',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
            closed_at: null,
            deleted_at: '2024-02-01T00:00:00.000Z'
          },
          total_children: 0,
          closed_children: 0,
          eligible_for_close: false
        }
      ]
    });

    const res = await fetchListForSubscription({ type: 'epics' });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.items).toHaveLength(1);
      expect(res.items[0]).toMatchObject({
        id: 'E-1',
        status: 'open'
      });
    }
  });

  test('issue-detail attaches comments fetched via bd comments', async () => {
    const rj = /** @type {import('vitest').Mock} */ (runBdJson);
    rj.mockResolvedValueOnce({
      code: 0,
      stdoutJson: [
        {
          id: 'UI-1',
          updated_at: '2024-01-01T00:00:00.000Z',
          comment_count: 1
        }
      ]
    });
    const comments = [
      {
        id: 'c-1',
        issue_id: 'UI-1',
        author: 'alice',
        text: 'First comment',
        created_at: '2024-01-02T00:00:00.000Z'
      }
    ];
    rj.mockResolvedValueOnce({ code: 0, stdoutJson: comments });

    const res = await fetchListForSubscription({
      type: 'issue-detail',
      params: { id: 'UI-1' }
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.items[0].comments).toEqual(comments);
    }
    expect(rj).toHaveBeenCalledWith(['comments', 'UI-1', '--json'], {
      cwd: undefined
    });
  });

  test('issue-detail skips comments fetch when comment_count is 0', async () => {
    const rj = /** @type {import('vitest').Mock} */ (runBdJson);
    rj.mockResolvedValueOnce({
      code: 0,
      stdoutJson: [
        {
          id: 'UI-1',
          updated_at: '2024-01-01T00:00:00.000Z',
          comment_count: 0
        }
      ]
    });

    const res = await fetchListForSubscription({
      type: 'issue-detail',
      params: { id: 'UI-1' }
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.items[0].comments).toEqual([]);
    }
    expect(rj).toHaveBeenCalledTimes(1);
  });

  test('issue-detail keeps inline comments from bd show output', async () => {
    const rj = /** @type {import('vitest').Mock} */ (runBdJson);
    const inline = [
      {
        id: 'c-1',
        issue_id: 'UI-1',
        author: 'alice',
        text: 'Inline comment',
        created_at: '2024-01-02T00:00:00.000Z'
      }
    ];
    rj.mockResolvedValueOnce({
      code: 0,
      stdoutJson: [
        {
          id: 'UI-1',
          updated_at: '2024-01-01T00:00:00.000Z',
          comments: inline
        }
      ]
    });

    const res = await fetchListForSubscription({
      type: 'issue-detail',
      params: { id: 'UI-1' }
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.items[0].comments).toEqual(inline);
    }
    expect(rj).toHaveBeenCalledTimes(1);
  });

  test('issue-detail leaves comments absent when comments fetch fails', async () => {
    const rj = /** @type {import('vitest').Mock} */ (runBdJson);
    rj.mockResolvedValueOnce({
      code: 0,
      stdoutJson: [
        {
          id: 'UI-1',
          updated_at: '2024-01-01T00:00:00.000Z',
          comment_count: 2
        }
      ]
    });
    rj.mockResolvedValueOnce({ code: 1, stderr: 'boom' });

    const res = await fetchListForSubscription({
      type: 'issue-detail',
      params: { id: 'UI-1' }
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.items[0].comments).toBeUndefined();
    }
  });

  test('fetchListForSubscription surfaces bd error', async () => {
    /** @type {import('vitest').Mock} */ (runBdJson).mockResolvedValue({
      code: 2,
      stderr: 'boom'
    });
    const res = await fetchListForSubscription({ type: 'all-issues' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('bd_error');
      expect(res.error.message).toContain('boom');
      expect(res.error.details && res.error.details.exit_code).toBe(2);
    }
  });

  test('fetchListForSubscription returns error for unknown type', async () => {
    const res = await fetchListForSubscription(
      /** @type {any} */ ({ type: 'unknown' })
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('bad_request');
      expect(res.error.message).toMatch(/Unknown subscription type/);
    }
  });
});
