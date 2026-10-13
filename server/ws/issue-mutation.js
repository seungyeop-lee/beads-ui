/**
 * Shared reply flow for bd-backed issue mutations over ws.
 *
 * @import { RequestEnvelope } from '../../app/protocol.js'
 * @import { WebSocket } from 'ws'
 */
import { makeError, makeOk } from '../../app/protocol.js';
import { runBd, runBdJson, showIssueArgs } from '../bd.js';
import { getCurrentWorkspace } from './context.js';
import { triggerMutationRefreshOnce } from './list-refresh.js';

/**
 * Run a bd mutation, reply with the re-fetched issue, and trigger one
 * subscription refresh.
 *
 * @param {WebSocket} ws
 * @param {RequestEnvelope} req
 * @param {string[]} bd_args - bd mutation command args.
 * @param {string} issue_id - issue to re-fetch for the reply payload.
 * @param {{ classifyError?: (stderr: string) => { code: string, message: string } | null }} [options]
 * Optional mapper turning a bd failure into a typed error reply; return
 * null to fall back to the generic `bd_error`.
 */
export async function runIssueMutation(
  ws,
  req,
  bd_args,
  issue_id,
  options = {}
) {
  const bd_options = { cwd: getCurrentWorkspace()?.root_dir };
  const res = await runBd(bd_args, bd_options);
  if (res.code !== 0) {
    const classified = options.classifyError?.(res.stderr || '');
    if (classified) {
      ws.send(
        JSON.stringify(makeError(req, classified.code, classified.message))
      );
      return;
    }
    ws.send(
      JSON.stringify(makeError(req, 'bd_error', res.stderr || 'bd failed'))
    );
    return;
  }
  const shown = await runBdJson(showIssueArgs(issue_id), bd_options);
  if (shown.code !== 0) {
    ws.send(
      JSON.stringify(makeError(req, 'bd_error', shown.stderr || 'bd failed'))
    );
    return;
  }
  // `bd show --json` returns an array of issues; the reply contract is the
  // updated issue object itself (see app/protocol.md).
  const out = Array.isArray(shown.stdoutJson)
    ? shown.stdoutJson[0]
    : shown.stdoutJson;
  if (!out) {
    ws.send(JSON.stringify(makeError(req, 'not_found', 'issue not found')));
    return;
  }
  ws.send(JSON.stringify(makeOk(req, out)));
  try {
    triggerMutationRefreshOnce();
  } catch {
    // ignore
  }
}
