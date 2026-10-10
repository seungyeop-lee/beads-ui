/**
 * Refresh scheduling and delta publishing for active list subscriptions.
 *
 * @import { MessageType } from '../../app/protocol.js'
 * @import { WebSocket } from 'ws'
 */
import { keyOf } from '../../app/data/subscription-key.js';
import { fetchListForSubscription } from '../list-adapters.js';
import { debug } from '../logging.js';
import { registry } from '../subscriptions.js';
import {
  ensureSubs,
  getCurrentWorkspace,
  getWss,
  nextListRevision
} from './context.js';

const log = debug('ws');

/**
 * Debounced refresh scheduling for active list subscriptions.
 * A trailing window coalesces rapid change bursts into a single refresh run.
 */
/** @type {ReturnType<typeof setTimeout> | null} */
let REFRESH_TIMER = null;
let REFRESH_DEBOUNCE_MS = 75;

/**
 * Set the watcher refresh debounce window; ignores values that are not
 * finite non-negative numbers.
 *
 * @param {unknown} value
 */
export function setRefreshDebounceMs(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    REFRESH_DEBOUNCE_MS = value;
  }
}

/**
 * Mutation refresh window gate. When active, watcher-driven list refresh
 * scheduling is suppressed. The gate resolves either when a watcher event
 * arrives (via scheduleListRefresh) or when a timeout elapses, at which
 * point a single refresh pass over all active list subscriptions is run.
 */
/**
 * @typedef {Object} MutationGate
 * @property {boolean} resolved
 * @property {(reason: 'watcher'|'timeout') => void} resolve
 * @property {ReturnType<typeof setTimeout>} timer
 */
/** @type {MutationGate | null} */
let MUTATION_GATE = null;

/**
 * Start a mutation window gate if not already active. The gate resolves on the
 * next watcher event or after `timeout_ms`, then triggers a single refresh run
 * across all active list subscriptions. Watcher-driven refresh scheduling is
 * suppressed during the window.
 *
 * Fire-and-forget; callers should not await this.
 *
 * @param {number} [timeout_ms]
 */
export function triggerMutationRefreshOnce(timeout_ms = 500) {
  if (MUTATION_GATE) {
    return;
  }
  /** @type {(r: 'watcher'|'timeout') => void} */
  let doResolve = () => {};
  const p = new Promise((resolve) => {
    doResolve = resolve;
  });
  MUTATION_GATE = {
    resolved: false,
    resolve: (reason) => {
      if (!MUTATION_GATE || MUTATION_GATE.resolved) {
        return;
      }
      MUTATION_GATE.resolved = true;
      try {
        doResolve(reason);
      } catch {
        // ignore resolve errors
      }
    },
    timer: setTimeout(() => {
      try {
        MUTATION_GATE?.resolve('timeout');
      } catch {
        // ignore
      }
    }, timeout_ms)
  };
  MUTATION_GATE.timer.unref?.();

  // After resolution, run a single refresh across active subs and clear gate
  void p.then(async () => {
    log('mutation window resolved → refresh active subs');
    try {
      await refreshAllActiveListSubscriptions();
    } catch {
      // ignore refresh errors
    } finally {
      try {
        clearTimeout(MUTATION_GATE?.timer);
      } catch {
        // ignore
      }
      MUTATION_GATE = null;
    }
  });
}

/**
 * Collect unique active list subscription specs across all connected clients.
 *
 * @returns {Array<{ type: string, params?: Record<string,string|number|boolean> }>}
 */
function collectActiveListSpecs() {
  /** @type {Array<{ type: string, params?: Record<string,string|number|boolean> }>} */
  const specs = [];
  /** @type {Set<string>} */
  const seen = new Set();
  const wss = getWss();
  if (!wss) {
    return specs;
  }
  for (const ws of wss.clients) {
    if (ws.readyState !== ws.OPEN) {
      continue;
    }
    const s = ensureSubs(/** @type {any} */ (ws));
    if (!s.list_subs) {
      continue;
    }
    for (const { key, spec } of s.list_subs.values()) {
      if (!seen.has(key)) {
        seen.add(key);
        specs.push(spec);
      }
    }
  }
  return specs;
}

/**
 * Run refresh for all active list subscription specs and publish deltas.
 */
async function refreshAllActiveListSubscriptions() {
  const specs = collectActiveListSpecs();
  // Run refreshes concurrently; locking is handled per key in the registry
  await Promise.all(
    specs.map(async (spec) => {
      try {
        await refreshAndPublish(spec);
      } catch {
        // ignore refresh errors per spec
      }
    })
  );
}

/**
 * Schedule a coalesced refresh of all active list subscriptions.
 */
export function scheduleListRefresh() {
  // Suppress watcher-driven refreshes during an active mutation gate; resolve gate once
  if (MUTATION_GATE) {
    try {
      MUTATION_GATE.resolve('watcher');
    } catch {
      // ignore
    }
    return;
  }
  clearTimeout(REFRESH_TIMER ?? undefined);
  REFRESH_TIMER = setTimeout(() => {
    REFRESH_TIMER = null;
    // Fire and forget; callers don't await scheduling
    void refreshAllActiveListSubscriptions();
  }, REFRESH_DEBOUNCE_MS);
  REFRESH_TIMER.unref?.();
}

/**
 * Emit per-subscription envelopes to a specific client id on a socket.
 * Helpers for snapshot / upsert / delete.
 */
/**
 * @param {WebSocket} ws
 * @param {string} client_id
 * @param {string} key
 * @param {Array<Record<string, unknown>>} issues
 */
export function emitSubscriptionSnapshot(ws, client_id, key, issues) {
  const revision = nextListRevision(ws, key);
  const payload = {
    type: /** @type {const} */ ('snapshot'),
    id: client_id,
    revision,
    issues
  };
  const msg = JSON.stringify({
    id: `evt-${Date.now()}`,
    ok: true,
    type: /** @type {MessageType} */ ('snapshot'),
    payload
  });
  try {
    ws.send(msg);
  } catch (err) {
    log('emit snapshot send failed key=%s id=%s: %o', key, client_id, err);
  }
}

/**
 * @param {WebSocket} ws
 * @param {string} client_id
 * @param {string} key
 * @param {Record<string, unknown>} issue
 */
function emitSubscriptionUpsert(ws, client_id, key, issue) {
  const revision = nextListRevision(ws, key);
  const payload = {
    type: 'upsert',
    id: client_id,
    revision,
    issue
  };
  const msg = JSON.stringify({
    id: `evt-${Date.now()}`,
    ok: true,
    type: /** @type {MessageType} */ ('upsert'),
    payload
  });
  try {
    ws.send(msg);
  } catch (err) {
    log('emit upsert send failed key=%s id=%s: %o', key, client_id, err);
  }
}

/**
 * @param {WebSocket} ws
 * @param {string} client_id
 * @param {string} key
 * @param {string} issue_id
 */
function emitSubscriptionDelete(ws, client_id, key, issue_id) {
  const revision = nextListRevision(ws, key);
  const payload = {
    type: 'delete',
    id: client_id,
    revision,
    issue_id
  };
  const msg = JSON.stringify({
    id: `evt-${Date.now()}`,
    ok: true,
    type: /** @type {MessageType} */ ('delete'),
    payload
  });
  try {
    ws.send(msg);
  } catch (err) {
    log('emit delete send failed key=%s id=%s: %o', key, client_id, err);
  }
}

// issues-changed removed in v2: detail and lists are pushed via subscriptions

/**
 * Refresh a subscription spec: fetch via adapter, apply to registry and emit
 * per-subscription full-issue envelopes to subscribers. Serialized per key.
 *
 * @param {{ type: string, params?: Record<string, string|number|boolean> }} spec
 */
async function refreshAndPublish(spec) {
  const key = keyOf(spec);
  await registry.withKeyLock(key, async () => {
    const res = await fetchListForSubscription(spec, {
      cwd: getCurrentWorkspace()?.root_dir
    });
    if (!res.ok) {
      log('refresh failed for %s: %s %o', key, res.error.message, res.error);
      return;
    }
    const items = applyClosedIssuesFilter(spec, res.items);
    const prev_size = registry.get(key)?.itemsById.size || 0;
    const delta = registry.applyItems(key, items);
    const entry = registry.get(key);
    if (!entry || entry.subscribers.size === 0) {
      return;
    }
    /** @type {Map<string, any>} */
    const by_id = new Map();
    for (const it of items) {
      if (it && typeof it.id === 'string') {
        by_id.set(it.id, it);
      }
    }
    for (const ws of entry.subscribers) {
      if (ws.readyState !== ws.OPEN) continue;
      const s = ensureSubs(ws);
      const subs = s.list_subs || new Map();
      /** @type {string[]} */
      const client_ids = [];
      for (const [cid, v] of subs.entries()) {
        if (v.key === key) client_ids.push(cid);
      }
      if (client_ids.length === 0) continue;
      if (prev_size === 0) {
        for (const cid of client_ids) {
          emitSubscriptionSnapshot(ws, cid, key, items);
        }
        continue;
      }
      for (const cid of client_ids) {
        for (const id of [...delta.added, ...delta.updated]) {
          const issue = by_id.get(id);
          if (issue) {
            emitSubscriptionUpsert(ws, cid, key, issue);
          }
        }
        for (const id of delta.removed) {
          emitSubscriptionDelete(ws, cid, key, id);
        }
      }
    }
  });
}

/**
 * Apply pre-diff filtering for closed-issues lists based on spec.params.since (epoch ms).
 *
 * @param {{ type: string, params?: Record<string, string|number|boolean> }} spec
 * @param {Array<{ id: string, updated_at: number, closed_at: number | null } & Record<string, unknown>>} items
 */
export function applyClosedIssuesFilter(spec, items) {
  if (String(spec.type) !== 'closed-issues') {
    return items;
  }
  const p = spec.params || {};
  const since = typeof p.since === 'number' ? p.since : 0;
  if (!Number.isFinite(since) || since <= 0) {
    return items;
  }
  /** @type {typeof items} */
  const out = [];
  for (const it of items) {
    const ca = it.closed_at;
    if (typeof ca === 'number' && Number.isFinite(ca) && ca >= since) {
      out.push(it);
    }
  }
  return out;
}
