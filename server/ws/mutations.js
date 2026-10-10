/**
 * Issue field mutation message handlers.
 *
 * @import { RequestEnvelope } from '../../app/protocol.js'
 * @import { WebSocket } from 'ws'
 */
import { makeError } from '../../app/protocol.js';
import { debug } from '../logging.js';
import { runIssueMutation } from './issue-mutation.js';

const log = debug('ws');

/**
 * Handle `update-assignee`: payload { id: string, assignee: string }.
 *
 * @param {WebSocket} ws
 * @param {RequestEnvelope} req
 */
export async function handleUpdateAssignee(ws, req) {
  const { id, assignee } = /** @type {any} */ (req.payload || {});
  if (
    typeof id !== 'string' ||
    id.length === 0 ||
    typeof assignee !== 'string'
  ) {
    ws.send(
      JSON.stringify(
        makeError(
          req,
          'bad_request',
          'payload requires { id: string, assignee: string }'
        )
      )
    );
    return;
  }
  // Pass empty string to clear assignee when requested
  await runIssueMutation(ws, req, ['update', id, '--assignee', assignee], id);
}

/**
 * Handle `update-status`: payload { id: string, status: 'open'|'in_progress'|'closed' }.
 *
 * @param {WebSocket} ws
 * @param {RequestEnvelope} req
 */
export async function handleUpdateStatus(ws, req) {
  log('update-status');
  const { id, status } = /** @type {any} */ (req.payload);
  const allowed = new Set(['open', 'in_progress', 'closed']);
  if (
    typeof id !== 'string' ||
    id.length === 0 ||
    typeof status !== 'string' ||
    !allowed.has(status)
  ) {
    ws.send(
      JSON.stringify(
        makeError(
          req,
          'bad_request',
          "payload requires { id: string, status: 'open'|'in_progress'|'closed' }"
        )
      )
    );
    return;
  }
  await runIssueMutation(ws, req, ['update', id, '--status', status], id);
}

/**
 * Handle `update-priority`: payload { id: string, priority: 0..4 }.
 *
 * @param {WebSocket} ws
 * @param {RequestEnvelope} req
 */
export async function handleUpdatePriority(ws, req) {
  log('update-priority');
  const { id, priority } = /** @type {any} */ (req.payload);
  if (
    typeof id !== 'string' ||
    id.length === 0 ||
    typeof priority !== 'number' ||
    priority < 0 ||
    priority > 4
  ) {
    ws.send(
      JSON.stringify(
        makeError(
          req,
          'bad_request',
          'payload requires { id: string, priority: 0..4 }'
        )
      )
    );
    return;
  }
  await runIssueMutation(
    ws,
    req,
    ['update', id, '--priority', String(priority)],
    id
  );
}

/**
 * Handle `edit-text`: payload { id: string, field: 'title'|'description'|'acceptance'|'notes'|'design', value: string }.
 *
 * @param {WebSocket} ws
 * @param {RequestEnvelope} req
 */
export async function handleEditText(ws, req) {
  log('edit-text');
  const { id, field, value } = /** @type {any} */ (req.payload);
  if (
    typeof id !== 'string' ||
    id.length === 0 ||
    (field !== 'title' &&
      field !== 'description' &&
      field !== 'acceptance' &&
      field !== 'notes' &&
      field !== 'design') ||
    typeof value !== 'string'
  ) {
    ws.send(
      JSON.stringify(
        makeError(
          req,
          'bad_request',
          "payload requires { id: string, field: 'title'|'description'|'acceptance'|'notes'|'design', value: string }"
        )
      )
    );
    return;
  }
  // Map UI fields to bd CLI flags
  // title       → --title
  // description → --description
  // acceptance  → --acceptance-criteria
  // notes       → --notes
  // design      → --design
  const flag =
    field === 'title'
      ? '--title'
      : field === 'description'
        ? '--description'
        : field === 'acceptance'
          ? '--acceptance-criteria'
          : field === 'notes'
            ? '--notes'
            : '--design';
  await runIssueMutation(ws, req, ['update', id, flag, value], id);
}
