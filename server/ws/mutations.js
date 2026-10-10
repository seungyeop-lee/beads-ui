/**
 * Issue field mutation message handlers.
 *
 * @import { RequestEnvelope } from '../../app/protocol.js'
 * @import { WebSocket } from 'ws'
 */
import { makeError } from '../../app/protocol.js';
import { bdSupportsClearNotes } from '../bd.js';
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
 * Detect bd's close-policy refusal so the UI can offer an explicit
 * force-close confirmation instead of a generic failure.
 *
 * bd 1.2.1+ refuses `bd update --status closed` while the issue has open
 * children ("cannot close <id>: N open child issue(s); close children first
 * or use --force to override") or a live blocker ("cannot close blocked
 * issue: <id> is blocked by [...]"); `bd update --force` overrides both.
 *
 * @param {string} stderr
 * @returns {{ code: string, message: string } | null}
 */
function classifyCloseRefusal(stderr) {
  const line = stderr
    .split('\n')
    .find(
      (l) =>
        /cannot close/i.test(l) &&
        (/open child/i.test(l) || /is blocked by/i.test(l))
    );
  if (!line) {
    return null;
  }
  return { code: 'close_blocked', message: line.trim() };
}

/**
 * Handle `update-status`: payload { id: string, status: 'open'|'in_progress'|'closed', force?: boolean }.
 *
 * `force` carries the user's explicit "close anyway" confirmation for bd's
 * close policy (open children / live blocker) and only applies to `closed`.
 *
 * @param {WebSocket} ws
 * @param {RequestEnvelope} req
 */
export async function handleUpdateStatus(ws, req) {
  log('update-status');
  const { id, status, force } = /** @type {any} */ (req.payload);
  const allowed = new Set(['open', 'in_progress', 'closed']);
  if (
    typeof id !== 'string' ||
    id.length === 0 ||
    typeof status !== 'string' ||
    !allowed.has(status) ||
    (force !== undefined && typeof force !== 'boolean')
  ) {
    ws.send(
      JSON.stringify(
        makeError(
          req,
          'bad_request',
          "payload requires { id: string, status: 'open'|'in_progress'|'closed', force?: boolean }"
        )
      )
    );
    return;
  }
  const args = ['update', id, '--status', status];
  if (status === 'closed' && force === true) {
    args.push('--force');
  }
  await runIssueMutation(ws, req, args, id, {
    classifyError: status === 'closed' ? classifyCloseRefusal : undefined
  });
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
  // Map UI fields to bd CLI flags:
  //   title → --title, description → --description,
  //   acceptance → --acceptance-criteria, design → --design.
  // notes is special: bd fences blind overwrites of existing notes. The UI
  // editor shows the current notes (a sighted edit), so a non-empty save
  // passes --force (bd logs the overwrite warning as an audit trail), and
  // clearing uses the dedicated --clear-notes verb where bd has it — bd up
  // to 1.3.1 still clears via `--notes ""`.
  /** @type {string[]} */
  let args;
  if (field === 'notes' && value === '') {
    const clear_supported = await bdSupportsClearNotes();
    args = clear_supported
      ? ['update', id, '--clear-notes']
      : ['update', id, '--notes', ''];
  } else if (field === 'notes') {
    args = ['update', id, '--notes', value, '--force'];
  } else {
    const flag =
      field === 'title'
        ? '--title'
        : field === 'description'
          ? '--description'
          : field === 'acceptance'
            ? '--acceptance-criteria'
            : '--design';
    args = ['update', id, flag, value];
  }
  await runIssueMutation(ws, req, args, id);
}
