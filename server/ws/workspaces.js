/**
 * Workspace message handlers.
 *
 * @import { RequestEnvelope } from '../../app/protocol.js'
 * @import { WebSocket } from 'ws'
 */
import path from 'node:path';
import { makeError, makeOk } from '../../app/protocol.js';
import { resolveWorkspaceDatabase } from '../db.js';
import { debug } from '../logging.js';
import { registry } from '../subscriptions.js';
import { getAvailableWorkspaces } from '../workspace-registry.js';
import {
  getCurrentWorkspace,
  getDbWatcher,
  setCurrentWorkspace
} from './context.js';
import { scheduleListRefresh } from './list-refresh.js';

const log = debug('ws');

/**
 * Handle `list-workspaces`: returns all available workspaces with the current one.
 *
 * @param {WebSocket} ws
 * @param {RequestEnvelope} req
 */
export async function handleListWorkspaces(ws, req) {
  log('list-workspaces');
  const workspaces = getAvailableWorkspaces();
  ws.send(
    JSON.stringify(
      makeOk(req, {
        workspaces,
        current: getCurrentWorkspace()
      })
    )
  );
}

/**
 * Handle `get-workspace`: returns the current workspace.
 *
 * @param {WebSocket} ws
 * @param {RequestEnvelope} req
 */
export async function handleGetWorkspace(ws, req) {
  log('get-workspace');
  ws.send(JSON.stringify(makeOk(req, getCurrentWorkspace())));
}

/**
 * Handle `set-workspace`: payload { path: string }.
 *
 * @param {WebSocket} ws
 * @param {RequestEnvelope} req
 */
export async function handleSetWorkspace(ws, req) {
  log('set-workspace');
  const { path: workspace_path } = /** @type {any} */ (req.payload || {});
  if (typeof workspace_path !== 'string' || workspace_path.length === 0) {
    ws.send(
      JSON.stringify(
        makeError(
          req,
          'bad_request',
          'payload requires { path: string } (absolute workspace path)'
        )
      )
    );
    return;
  }

  // Resolve and validate the path
  const resolved = path.resolve(workspace_path);

  // Update workspace (this will rebind watcher, clear registry, broadcast change)
  const new_db = resolveWorkspaceDatabase({ cwd: resolved });
  const old_path = getCurrentWorkspace()?.db_path || '';

  setCurrentWorkspace({
    root_dir: resolved,
    db_path: new_db.path
  });

  const changed = new_db.path !== old_path;

  if (changed) {
    log('workspace changed via set-workspace: %s → %s', old_path, new_db.path);

    // Rebind the database watcher
    const db_watcher = getDbWatcher();
    if (db_watcher) {
      db_watcher.rebind({ root_dir: resolved });
    }

    // Clear existing registry entries
    registry.clear();

    // Schedule refresh of all active list subscriptions
    scheduleListRefresh();
  }

  ws.send(
    JSON.stringify(
      makeOk(req, {
        changed,
        workspace: getCurrentWorkspace()
      })
    )
  );
}
