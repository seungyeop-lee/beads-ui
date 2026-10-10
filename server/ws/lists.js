/**
 * List subscription message handlers.
 *
 * @import { RequestEnvelope } from '../../app/protocol.js'
 * @import { WebSocket } from 'ws'
 */
import { makeError, makeOk } from '../../app/protocol.js';
import { fetchListForSubscription } from '../list-adapters.js';
import { debug } from '../logging.js';
import { keyOf, registry } from '../subscriptions.js';
import { validateSubscribeListPayload } from '../validators.js';
import { ensureSubs, getCurrentWorkspace } from './context.js';
import {
  applyClosedIssuesFilter,
  emitSubscriptionSnapshot
} from './list-refresh.js';

const log = debug('ws');

/**
 * Handle `subscribe-list`: payload { id: string, type: string, params?: object }.
 *
 * @param {WebSocket} ws
 * @param {RequestEnvelope} req
 */
export async function handleSubscribeList(ws, req) {
  const payload_id = /** @type {any} */ (req.payload)?.id || '';
  log('subscribe-list %s', payload_id);
  const validation = validateSubscribeListPayload(
    /** @type {any} */ (req.payload || {})
  );
  if (!validation.ok) {
    ws.send(
      JSON.stringify(makeError(req, validation.code, validation.message))
    );
    return;
  }
  const client_id = validation.id;
  const spec = validation.spec;
  const key = keyOf(spec);

  /**
   * Reply with an error and avoid attaching the subscription when
   * initialization fails.
   *
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>|undefined} details
   */
  const replyWithError = (code, message, details = undefined) => {
    ws.send(JSON.stringify(makeError(req, code, message, details)));
  };

  /** @type {Awaited<ReturnType<typeof fetchListForSubscription>> | null} */
  let initial = null;
  try {
    initial = await fetchListForSubscription(spec, {
      cwd: getCurrentWorkspace()?.root_dir
    });
  } catch (err) {
    log('subscribe-list snapshot error for %s: %o', key, err);
    const message =
      (err && /** @type {any} */ (err).message) || 'Failed to load list';
    replyWithError('bd_error', String(message), { key });
    return;
  }

  if (!initial.ok) {
    log(
      'initial snapshot failed for %s: %s %o',
      key,
      initial.error.message,
      initial.error
    );
    const details = { ...(initial.error.details || {}), key };
    replyWithError(initial.error.code, initial.error.message, details);
    return;
  }

  const s = ensureSubs(ws);
  const { key: attached_key } = registry.attach(spec, ws);
  s.list_subs?.set(client_id, { key: attached_key, spec });

  try {
    await registry.withKeyLock(attached_key, async () => {
      const items = applyClosedIssuesFilter(spec, initial ? initial.items : []);
      void registry.applyItems(attached_key, items);
      emitSubscriptionSnapshot(ws, client_id, attached_key, items);
    });
  } catch (err) {
    log('subscribe-list snapshot error for %s: %o', attached_key, err);
    s.list_subs?.delete(client_id);
    try {
      registry.detach(spec, ws);
    } catch {
      // ignore detach errors
    }
    replyWithError('bd_error', 'Failed to publish snapshot', { key });
    return;
  }

  ws.send(JSON.stringify(makeOk(req, { id: client_id, key: attached_key })));
}

/**
 * Handle `unsubscribe-list`: payload { id: string }.
 *
 * @param {WebSocket} ws
 * @param {RequestEnvelope} req
 */
export async function handleUnsubscribeList(ws, req) {
  log('unsubscribe-list %s', /** @type {any} */ (req.payload)?.id || '');
  const { id: client_id } = /** @type {any} */ (req.payload || {});
  if (typeof client_id !== 'string' || client_id.length === 0) {
    ws.send(
      JSON.stringify(
        makeError(req, 'bad_request', 'payload.id must be a non-empty string')
      )
    );
    return;
  }
  const s = ensureSubs(ws);
  const sub = s.list_subs?.get(client_id) || null;
  let removed = false;
  if (sub) {
    try {
      removed = registry.detach(sub.spec, ws);
    } catch {
      removed = false;
    }
    s.list_subs?.delete(client_id);
  }
  ws.send(
    JSON.stringify(
      makeOk(req, {
        id: client_id,
        unsubscribed: removed
      })
    )
  );
}
