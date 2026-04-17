import { describe, expect, test } from 'vitest';
import { computeIssuesSpec } from './main.js';

describe('computeIssuesSpec', () => {
  test('Any (undefined) → filtered-issues with all three statuses', () => {
    expect(computeIssuesSpec({})).toEqual({
      type: 'filtered-issues',
      params: { statuses: 'open,in_progress,closed' }
    });
  });

  test('Any (empty array) → filtered-issues with all three statuses', () => {
    expect(computeIssuesSpec({ status: [] })).toEqual({
      type: 'filtered-issues',
      params: { statuses: 'open,in_progress,closed' }
    });
  });

  test('legacy string "all" → filtered-issues with all three statuses', () => {
    expect(computeIssuesSpec({ status: 'all' })).toEqual({
      type: 'filtered-issues',
      params: { statuses: 'open,in_progress,closed' }
    });
  });

  test('single ready → ready-issues', () => {
    expect(computeIssuesSpec({ status: ['ready'] })).toEqual({
      type: 'ready-issues'
    });
  });

  test('legacy string "ready" → ready-issues', () => {
    expect(computeIssuesSpec({ status: 'ready' })).toEqual({
      type: 'ready-issues'
    });
  });

  test('ready mixed with others → ready-issues (ready wins)', () => {
    expect(computeIssuesSpec({ status: ['ready', 'closed'] })).toEqual({
      type: 'ready-issues'
    });
  });

  test('single in_progress → in-progress-issues', () => {
    expect(computeIssuesSpec({ status: ['in_progress'] })).toEqual({
      type: 'in-progress-issues'
    });
  });

  test('single closed → closed-issues', () => {
    expect(computeIssuesSpec({ status: ['closed'] })).toEqual({
      type: 'closed-issues'
    });
  });

  test('single open → filtered-issues with only open', () => {
    expect(computeIssuesSpec({ status: ['open'] })).toEqual({
      type: 'filtered-issues',
      params: { statuses: 'open' }
    });
  });

  test('closed + open → filtered-issues CSV preserves order', () => {
    expect(computeIssuesSpec({ status: ['closed', 'open'] })).toEqual({
      type: 'filtered-issues',
      params: { statuses: 'closed,open' }
    });
  });

  test('in_progress + closed → filtered-issues CSV', () => {
    expect(computeIssuesSpec({ status: ['in_progress', 'closed'] })).toEqual({
      type: 'filtered-issues',
      params: { statuses: 'in_progress,closed' }
    });
  });

  test('all three selected → filtered-issues with all three', () => {
    expect(
      computeIssuesSpec({ status: ['open', 'in_progress', 'closed'] })
    ).toEqual({
      type: 'filtered-issues',
      params: { statuses: 'open,in_progress,closed' }
    });
  });
});
