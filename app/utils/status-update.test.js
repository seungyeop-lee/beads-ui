import { describe, expect, test, vi } from 'vitest';
import { updateIssueStatus } from './status-update.js';

describe('updateIssueStatus', () => {
  test('passes payload through and resolves on success', async () => {
    const send = vi.fn().mockResolvedValue({ id: 'UI-1', status: 'closed' });
    const confirm = vi.fn();
    const res = await updateIssueStatus(
      send,
      { id: 'UI-1', status: 'closed' },
      confirm
    );
    expect(res).toEqual({ id: 'UI-1', status: 'closed' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('update-status', {
      id: 'UI-1',
      status: 'closed'
    });
    expect(confirm).not.toHaveBeenCalled();
  });

  test('retries with force after confirmation on close_blocked', async () => {
    const refusal = {
      code: 'close_blocked',
      message: 'cannot close UI-1: 2 open child issue(s)'
    };
    const send = vi
      .fn()
      .mockRejectedValueOnce(refusal)
      .mockResolvedValueOnce({ id: 'UI-1', status: 'closed' });
    const confirm = vi.fn().mockResolvedValue(true);
    const res = await updateIssueStatus(
      send,
      { id: 'UI-1', status: 'closed' },
      confirm
    );
    expect(res).toEqual({ id: 'UI-1', status: 'closed' });
    expect(confirm).toHaveBeenCalledWith(
      'cannot close UI-1: 2 open child issue(s)'
    );
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith('update-status', {
      id: 'UI-1',
      status: 'closed',
      force: true
    });
  });

  test('rejects with the refusal when the user declines the force close', async () => {
    const refusal = { code: 'close_blocked', message: 'cannot close UI-1' };
    const send = vi.fn().mockRejectedValue(refusal);
    const confirm = vi.fn().mockResolvedValue(false);
    await expect(
      updateIssueStatus(send, { id: 'UI-1', status: 'closed' }, confirm)
    ).rejects.toBe(refusal);
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('rethrows other errors without confirming', async () => {
    const err = { code: 'bd_error', message: 'boom' };
    const send = vi.fn().mockRejectedValue(err);
    const confirm = vi.fn();
    await expect(
      updateIssueStatus(send, { id: 'UI-1', status: 'closed' }, confirm)
    ).rejects.toBe(err);
    expect(confirm).not.toHaveBeenCalled();
  });

  test('retries the force close when the payload already carries no extra keys', async () => {
    const refusal = { code: 'close_blocked', message: 'nope' };
    const send = vi
      .fn()
      .mockRejectedValueOnce(refusal)
      .mockResolvedValueOnce({ id: 'UI-2', status: 'closed' });
    await updateIssueStatus(send, { id: 'UI-2', status: 'closed' }, () =>
      Promise.resolve(true)
    );
    expect(send).toHaveBeenLastCalledWith('update-status', {
      id: 'UI-2',
      status: 'closed',
      force: true
    });
  });
});
