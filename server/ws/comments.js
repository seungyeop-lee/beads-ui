/**
 * Comment message handlers.
 *
 * @import { RequestEnvelope } from '../../app/protocol.js'
 * @import { WebSocket } from 'ws'
 */
import { makeError, makeOk } from '../../app/protocol.js';
import { getGitUserName, runBd, runBdJson } from '../bd.js';

/**
 * Handle `get-comments`: payload { id: string }.
 *
 * @param {WebSocket} ws
 * @param {RequestEnvelope} req
 */
export async function handleGetComments(ws, req) {
  const { id } = /** @type {any} */ (req.payload || {});
  if (typeof id !== 'string' || id.length === 0) {
    ws.send(
      JSON.stringify(
        makeError(req, 'bad_request', 'payload requires { id: string }')
      )
    );
    return;
  }
  const res = await runBdJson(['comments', id, '--json']);
  if (res.code !== 0) {
    ws.send(
      JSON.stringify(makeError(req, 'bd_error', res.stderr || 'bd failed'))
    );
    return;
  }
  ws.send(JSON.stringify(makeOk(req, res.stdoutJson || [])));
}

/**
 * Handle `add-comment`: payload { id: string, text: string }.
 *
 * @param {WebSocket} ws
 * @param {RequestEnvelope} req
 */
export async function handleAddComment(ws, req) {
  const { id, text } = /** @type {any} */ (req.payload || {});
  if (
    typeof id !== 'string' ||
    id.length === 0 ||
    typeof text !== 'string' ||
    text.trim().length === 0
  ) {
    ws.send(
      JSON.stringify(
        makeError(
          req,
          'bad_request',
          'payload requires { id: string, text: non-empty string }'
        )
      )
    );
    return;
  }

  // Get git user name for author attribution. bd 1.x removed the
  // `--author` flag; the global `--actor` flag sets the comment author.
  const author = await getGitUserName();
  const args = ['comment', id, text.trim()];
  if (author) {
    args.push('--actor', author);
  }

  const res = await runBd(args);
  if (res.code !== 0) {
    ws.send(
      JSON.stringify(makeError(req, 'bd_error', res.stderr || 'bd failed'))
    );
    return;
  }

  // Return updated comments list
  const comments = await runBdJson(['comments', id, '--json']);
  if (comments.code !== 0) {
    ws.send(
      JSON.stringify(makeError(req, 'bd_error', comments.stderr || 'bd failed'))
    );
    return;
  }
  ws.send(JSON.stringify(makeOk(req, comments.stdoutJson || [])));
}
