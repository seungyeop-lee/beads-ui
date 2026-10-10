/**
 * Shared connection and workspace state for the WebSocket server.
 *
 * @import { WebSocket, WebSocketServer } from 'ws'
 */

/**
 * @typedef {{
 *   show_id?: string | null,
 *   list_subs?: Map<string, { key: string, spec: { type: string, params?: Record<string, string | number | boolean> } }>,
 *   list_revisions?: Map<string, number>
 * }} ConnectionSubs
 */

/** @type {WeakMap<WebSocket, any>} */
const SUBS = new WeakMap();

/** @type {WebSocketServer | null} */
let CURRENT_WSS = null;

/**
 * Current workspace configuration.
 *
 * @type {{ root_dir: string, db_path: string } | null}
 */
let CURRENT_WORKSPACE = null;

/**
 * Reference to the database watcher for rebinding on workspace change.
 *
 * @type {{ rebind: (opts?: { root_dir?: string }) => void, path: string } | null}
 */
let DB_WATCHER = null;

/**
 * Get or initialize the subscription state for a socket.
 *
 * @param {WebSocket} ws
 * @returns {any}
 */
export function ensureSubs(ws) {
  let s = SUBS.get(ws);
  if (!s) {
    s = {
      show_id: null,
      list_subs: new Map(),
      list_revisions: new Map()
    };
    SUBS.set(ws, s);
  }
  return s;
}

/**
 * Get next monotonically increasing revision for a subscription key on this
 * connection.
 *
 * @param {WebSocket} ws
 * @param {string} key
 */
export function nextListRevision(ws, key) {
  const s = ensureSubs(ws);
  const m = s.list_revisions || new Map();
  s.list_revisions = m;
  const prev = m.get(key) || 0;
  const next = prev + 1;
  m.set(key, next);
  return next;
}

/** Get the active WebSocket server, if attached. */
export function getWss() {
  return CURRENT_WSS;
}

/**
 * Set the active WebSocket server.
 *
 * @param {WebSocketServer} wss
 */
export function setWss(wss) {
  CURRENT_WSS = wss;
}

/** Get the current workspace configuration. */
export function getCurrentWorkspace() {
  return CURRENT_WORKSPACE;
}

/**
 * Set the current workspace configuration.
 *
 * @param {{ root_dir: string, db_path: string }} workspace
 */
export function setCurrentWorkspace(workspace) {
  CURRENT_WORKSPACE = workspace;
}

/** Get the database watcher, if registered. */
export function getDbWatcher() {
  return DB_WATCHER;
}

/**
 * Set the database watcher.
 *
 * @param {{ rebind: (opts?: { root_dir?: string }) => void, path: string }} watcher
 */
export function setDbWatcher(watcher) {
  DB_WATCHER = watcher;
}
