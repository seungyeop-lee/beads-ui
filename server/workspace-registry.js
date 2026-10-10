import path from 'node:path';
import { debug } from './logging.js';

const log = debug('workspace-registry');

/**
 * In-memory registry of workspaces registered dynamically via the API.
 *
 * bd 1.x no longer writes the SQLite-era `~/.beads/registry.json` daemon
 * registry, so there is no file to read or watch. Workspaces become known
 * when `bdui start` registers them against an already-running server.
 *
 * @type {Map<string, { path: string, database: string, pid: number, version: string }>}
 */
const inMemoryWorkspaces = new Map();

/**
 * Register a workspace dynamically (in-memory).
 * This allows `bdui start` to register workspaces when the server is already running.
 *
 * @param {{ path: string, database: string }} workspace
 */
export function registerWorkspace(workspace) {
  const normalized = path.resolve(workspace.path);
  log('registering workspace: %s (db: %s)', normalized, workspace.database);
  inMemoryWorkspaces.set(normalized, {
    path: normalized,
    database: workspace.database,
    pid: process.pid,
    version: 'dynamic'
  });
}

/**
 * Get all available workspaces (registered dynamically in-memory).
 *
 * @returns {Array<{ path: string, database: string, pid: number, version: string }>}
 */
export function getAvailableWorkspaces() {
  return Array.from(inMemoryWorkspaces.values());
}
