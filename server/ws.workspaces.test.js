import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getAvailableWorkspaces } from './registry-watcher.js';
import { handleMessage } from './ws.js';

vi.mock('./registry-watcher.js', () => ({
  getAvailableWorkspaces: vi.fn()
}));

vi.mock('./db.js', () => ({
  resolveWorkspaceDatabase: /** @param {{ cwd: string }} opts */ (opts) => ({
    path: `${opts.cwd}/.beads/beads.db`
  })
}));

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

/**
 * Send one request envelope and parse the reply it produced.
 *
 * @param {ReturnType<typeof makeStubSocket>} ws
 * @param {string} type
 * @param {Record<string, unknown>} payload
 */
async function send(ws, type, payload = {}) {
  const id = `req-${ws.sent.length + 1}`;
  await handleMessage(
    /** @type {any} */ (ws),
    Buffer.from(
      JSON.stringify({ id, type: /** @type {any} */ (type), payload })
    )
  );
  return JSON.parse(ws.sent[ws.sent.length - 1]);
}

describe('workspace message handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns null current workspace before initialization', async () => {
    const ws = makeStubSocket();

    const reply = await send(ws, 'get-workspace');

    expect(reply.ok).toBe(true);
    expect(reply.payload).toBe(null);
  });

  test('rejects set-workspace without a path', async () => {
    const ws = makeStubSocket();

    const reply = await send(ws, 'set-workspace', {});

    expect(reply.ok).toBe(false);
    expect(reply.error.code).toBe('bad_request');
  });

  test('switches workspace and reports the change', async () => {
    const ws = makeStubSocket();

    const reply = await send(ws, 'set-workspace', { path: '/tmp/ws-a' });

    expect(reply.ok).toBe(true);
    expect(reply.payload.changed).toBe(true);
    expect(reply.payload.workspace).toEqual({
      root_dir: '/tmp/ws-a',
      db_path: '/tmp/ws-a/.beads/beads.db'
    });
  });

  test('reports no change when reapplying the same workspace', async () => {
    const ws = makeStubSocket();
    await send(ws, 'set-workspace', { path: '/tmp/ws-a' });

    const reply = await send(ws, 'set-workspace', { path: '/tmp/ws-a' });

    expect(reply.ok).toBe(true);
    expect(reply.payload.changed).toBe(false);
    expect(reply.payload.workspace.root_dir).toBe('/tmp/ws-a');
  });

  test('lists available workspaces with the current workspace', async () => {
    const workspaces = [
      { root_dir: '/repos/other', db_path: '/repos/other/.beads/beads.db' }
    ];
    const gaw = /** @type {import('vitest').Mock} */ (getAvailableWorkspaces);
    gaw.mockReturnValueOnce(workspaces);
    const ws = makeStubSocket();
    await send(ws, 'set-workspace', { path: '/tmp/ws-b' });

    const reply = await send(ws, 'list-workspaces');

    expect(reply.ok).toBe(true);
    expect(reply.payload.workspaces).toEqual(workspaces);
    expect(reply.payload.current.root_dir).toBe('/tmp/ws-b');
  });
});
