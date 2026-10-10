/**
 * Dependency edge message handlers.
 *
 * @import { RequestEnvelope } from '../../app/protocol.js'
 * @import { WebSocket } from 'ws'
 */
import { makeError } from '../../app/protocol.js';
import { runIssueMutation } from './issue-mutation.js';

/**
 * Apply a dependency edge change: payload { a: string, b: string, view_id?: string }.
 *
 * @param {WebSocket} ws
 * @param {RequestEnvelope} req
 * @param {'add' | 'remove'} verb - bd dep subcommand.
 */
async function applyDepChange(ws, req, verb) {
  const { a, b, view_id } = /** @type {any} */ (req.payload || {});
  if (
    typeof a !== 'string' ||
    a.length === 0 ||
    typeof b !== 'string' ||
    b.length === 0
  ) {
    ws.send(
      JSON.stringify(
        makeError(
          req,
          'bad_request',
          'payload requires { a: string, b: string }'
        )
      )
    );
    return;
  }
  const show_id =
    typeof view_id === 'string' && view_id.length > 0 ? view_id : a;
  await runIssueMutation(ws, req, ['dep', verb, a, b], show_id);
}

/**
 * Handle `dep-add`: payload { a: string, b: string, view_id?: string }.
 *
 * @param {WebSocket} ws
 * @param {RequestEnvelope} req
 */
export async function handleDepAdd(ws, req) {
  await applyDepChange(ws, req, 'add');
}

/**
 * Handle `dep-remove`: payload { a: string, b: string, view_id?: string }.
 *
 * @param {WebSocket} ws
 * @param {RequestEnvelope} req
 */
export async function handleDepRemove(ws, req) {
  await applyDepChange(ws, req, 'remove');
}
