/**
 * Label message handlers.
 *
 * @import { RequestEnvelope } from '../../app/protocol.js'
 * @import { WebSocket } from 'ws'
 */
import { makeError } from '../../app/protocol.js';
import { runIssueMutation } from './issue-mutation.js';

/**
 * Apply a label change: payload { id: string, label: string }.
 *
 * @param {WebSocket} ws
 * @param {RequestEnvelope} req
 * @param {'add' | 'remove'} verb - bd label subcommand.
 */
async function applyLabelChange(ws, req, verb) {
  const { id, label } = /** @type {any} */ (req.payload || {});
  if (
    typeof id !== 'string' ||
    id.length === 0 ||
    typeof label !== 'string' ||
    label.trim().length === 0
  ) {
    ws.send(
      JSON.stringify(
        makeError(
          req,
          'bad_request',
          'payload requires { id: string, label: non-empty string }'
        )
      )
    );
    return;
  }
  await runIssueMutation(ws, req, ['label', verb, id, label.trim()], id);
}

/**
 * Handle `label-add`: payload { id: string, label: string }.
 *
 * @param {WebSocket} ws
 * @param {RequestEnvelope} req
 */
export async function handleLabelAdd(ws, req) {
  await applyLabelChange(ws, req, 'add');
}

/**
 * Handle `label-remove`: payload { id: string, label: string }.
 *
 * @param {WebSocket} ws
 * @param {RequestEnvelope} req
 */
export async function handleLabelRemove(ws, req) {
  await applyLabelChange(ws, req, 'remove');
}
