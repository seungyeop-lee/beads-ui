import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getGitUserName, runBd, runBdJson } from './bd.js';
import { handleMessage } from './ws.js';
import { setCurrentWorkspace } from './ws/context.js';

vi.mock('./bd.js', () => ({
  runBd: vi.fn(),
  runBdJson: vi.fn(),
  getGitUserName: vi.fn(),
  bdSupportsClearNotes: vi.fn(),
  showIssueArgs: /** @param {string} id */ (id) => [
    'show',
    id,
    '--json',
    '--include-dependents'
  ]
}));

const WORKSPACE_ROOT = '/repos/other';

function makeStubSocket() {
  return {
    sent: /** @type {string[]} */ ([]),
    readyState: 1,
    OPEN: 1,
    /** @param {string} msg */
    send(msg) {
      this.sent.push(String(msg));
    }
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  /** @type {import('vitest').Mock} */ (runBd).mockResolvedValue({
    code: 0,
    stdout: '',
    stderr: ''
  });
  /** @type {import('vitest').Mock} */ (runBdJson).mockResolvedValue({
    code: 0,
    stdoutJson: [{ id: 'UI-1', status: 'in_progress' }]
  });
  /** @type {import('vitest').Mock} */ (getGitUserName).mockResolvedValue(
    'alice'
  );
  setCurrentWorkspace({
    root_dir: WORKSPACE_ROOT,
    db_path: `${WORKSPACE_ROOT}/.beads/beads.db`
  });
});

describe('bd commands run in the current workspace', () => {
  test.each([
    ['update-status', { id: 'UI-1', status: 'in_progress' }],
    ['create-issue', { title: 'New issue' }],
    ['delete-issue', { id: 'UI-1' }],
    ['add-comment', { id: 'UI-1', text: 'hello' }],
    ['get-comments', { id: 'UI-1' }]
  ])('%s', async (type, payload) => {
    const ws = makeStubSocket();

    await handleMessage(
      /** @type {any} */ (ws),
      Buffer.from(JSON.stringify({ id: 'r1', type, payload }))
    );

    const calls = [
      .../** @type {import('vitest').Mock} */ (runBd).mock.calls,
      .../** @type {import('vitest').Mock} */ (runBdJson).mock.calls,
      .../** @type {import('vitest').Mock} */ (getGitUserName).mock.calls
    ];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.at(-1)).toEqual({ cwd: WORKSPACE_ROOT });
    }
  });
});
