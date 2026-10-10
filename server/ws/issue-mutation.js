/**
 * Shared reply flow for bd-backed issue mutations over ws.
 *
 * @import { RequestEnvelope } from '../../app/protocol.js'
 * @import { WebSocket } from 'ws'
 */
import { makeError, makeOk } from '../../app/protocol.js';
import { runBd, runBdJson, showIssueArgs } from '../bd.js';
import { triggerMutationRefreshOnce } from './list-refresh.js';

/**
 * Run a bd mutation, reply with the re-fetched issue, and trigger one
 * subscription refresh.
 *
 * @param {WebSocket} ws
 * @param {RequestEnvelope} req
 * @param {string[]} bd_args - bd mutation command args.
 * @param {string} issue_id - issue to re-fetch for the reply payload.
 */
export async function runIssueMutation(ws, req, bd_args, issue_id) {
  const res = await runBd(bd_args);
  if (res.code !== 0) {
    ws.send(
      JSON.stringify(makeError(req, 'bd_error', res.stderr || 'bd failed'))
    );
    return;
  }
  const shown = await runBdJson(showIssueArgs(issue_id));
  if (shown.code !== 0) {
    ws.send(
      JSON.stringify(makeError(req, 'bd_error', shown.stderr || 'bd failed'))
    );
    return;
  }
  ws.send(JSON.stringify(makeOk(req, shown.stdoutJson)));
  try {
    triggerMutationRefreshOnce();
  } catch {
    // ignore
  }
}
