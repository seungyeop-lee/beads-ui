/**
 * @import { Server } from 'node:http'
 * @import { RawData, WebSocket } from 'ws'
 * @import { RequestEnvelope } from '../app/protocol.js'
 */
import { WebSocketServer } from 'ws';
import { isRequest, makeError, makeOk } from '../app/protocol.js';
import { resolveWorkspaceDatabase } from './db.js';
import { debug } from './logging.js';
import { registry } from './subscriptions.js';
import { handleAddComment, handleGetComments } from './ws/comments.js';
import {
  ensureSubs,
  setCurrentWorkspace,
  setDbWatcher,
  setWss
} from './ws/context.js';
import { handleDepAdd, handleDepRemove } from './ws/deps.js';
import { handleCreateIssue, handleDeleteIssue } from './ws/issues.js';
import { handleLabelAdd, handleLabelRemove } from './ws/labels.js';
import {
  scheduleListRefresh,
  setRefreshDebounceMs
} from './ws/list-refresh.js';
import { handleSubscribeList, handleUnsubscribeList } from './ws/lists.js';
import {
  handleEditText,
  handleUpdateAssignee,
  handleUpdatePriority,
  handleUpdateStatus
} from './ws/mutations.js';
import {
  handleGetWorkspace,
  handleListWorkspaces,
  handleSetWorkspace
} from './ws/workspaces.js';

export { scheduleListRefresh };

const log = debug('ws');

/**
 * Attach a WebSocket server to an existing HTTP server.
 *
 * @param {Server} http_server
 * @param {{ path?: string, heartbeat_ms?: number, refresh_debounce_ms?: number, root_dir?: string, watcher?: { rebind: (opts?: { root_dir?: string }) => void, path: string } }} [options]
 * @returns {{ wss: WebSocketServer, scheduleListRefresh: () => void }}
 */
export function attachWsServer(http_server, options = {}) {
  const ws_path = options.path || '/ws';

  // Initialize workspace state
  const initial_root = options.root_dir || process.cwd();
  const initial_db = resolveWorkspaceDatabase({ cwd: initial_root });
  setCurrentWorkspace({
    root_dir: initial_root,
    db_path: initial_db.path
  });

  if (options.watcher) {
    setDbWatcher(options.watcher);
  }
  const heartbeat_ms = options.heartbeat_ms ?? 30000;
  setRefreshDebounceMs(options.refresh_debounce_ms);

  const wss = new WebSocketServer({ server: http_server, path: ws_path });
  setWss(wss);

  // Heartbeat: track if client answered the last ping
  wss.on('connection', (ws) => {
    log('client connected');
    // @ts-expect-error add marker property
    ws.isAlive = true;

    // Initialize subscription state for this connection
    ensureSubs(ws);

    ws.on('pong', () => {
      // @ts-expect-error marker
      ws.isAlive = true;
    });

    ws.on('message', (data) => {
      handleMessage(ws, data);
    });

    ws.on('close', () => {
      try {
        registry.onDisconnect(ws);
      } catch {
        // ignore cleanup errors
      }
    });
  });

  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      // @ts-expect-error marker
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      // @ts-expect-error marker
      ws.isAlive = false;
      ws.ping();
    }
  }, heartbeat_ms);

  interval.unref?.();

  wss.on('close', () => {
    clearInterval(interval);
  });

  return {
    wss,
    scheduleListRefresh
  };
}

/**
 * @typedef {(ws: WebSocket, req: RequestEnvelope) => void | Promise<void>} MessageHandler
 */

// Removed: subscribe-updates and subscribe-issues. No-ops in v2.
// list-issues and epic-status were removed in favor of push-only subscriptions.
// Removed: show-issue. Details flow is push-only via `subscribe-list { type: 'issue-detail' }`.
// type updates are not exposed via UI; no handler.

/**
 * Dispatch table for known request types.
 *
 * @type {Map<string, MessageHandler>}
 */
const MESSAGE_HANDLERS = new Map([
  [
    'ping',
    (ws, req) => {
      ws.send(JSON.stringify(makeOk(req, { ts: Date.now() })));
    }
  ],
  ['subscribe-list', handleSubscribeList],
  ['unsubscribe-list', handleUnsubscribeList],
  ['update-assignee', handleUpdateAssignee],
  ['update-status', handleUpdateStatus],
  ['update-priority', handleUpdatePriority],
  ['edit-text', handleEditText],
  ['create-issue', handleCreateIssue],
  ['dep-add', handleDepAdd],
  ['dep-remove', handleDepRemove],
  ['label-add', handleLabelAdd],
  ['label-remove', handleLabelRemove],
  ['get-comments', handleGetComments],
  ['add-comment', handleAddComment],
  ['delete-issue', handleDeleteIssue],
  ['list-workspaces', handleListWorkspaces],
  ['get-workspace', handleGetWorkspace],
  ['set-workspace', handleSetWorkspace]
]);

/**
 * Handle an incoming message frame and respond to the same socket.
 *
 * @param {WebSocket} ws
 * @param {RawData} data
 */
export async function handleMessage(ws, data) {
  /** @type {unknown} */
  let json;
  try {
    json = JSON.parse(data.toString());
  } catch {
    const reply = {
      id: 'unknown',
      ok: false,
      type: 'bad-json',
      error: { code: 'bad_json', message: 'Invalid JSON' }
    };
    ws.send(JSON.stringify(reply));
    return;
  }

  if (!isRequest(json)) {
    log('invalid request');
    const reply = {
      id: 'unknown',
      ok: false,
      type: 'bad-request',
      error: { code: 'bad_request', message: 'Invalid request envelope' }
    };
    ws.send(JSON.stringify(reply));
    return;
  }

  const req = json;

  const handler = MESSAGE_HANDLERS.get(req.type);
  if (handler) {
    await handler(ws, req);
    return;
  }

  // Unknown type
  const err = makeError(
    req,
    'unknown_type',
    `Unknown message type: ${req.type}`
  );
  ws.send(JSON.stringify(err));
}
