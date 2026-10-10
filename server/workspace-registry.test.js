import path from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Freshly import the module so its in-memory registry starts empty.
 *
 * @returns {Promise<typeof import('./workspace-registry.js')>}
 */
function freshModule() {
  return import('./workspace-registry.js');
}

beforeEach(() => {
  vi.resetModules();
});

describe('workspace registry', () => {
  test('registerWorkspace stores resolved path with pid and dynamic version', async () => {
    const mod = await freshModule();
    mod.registerWorkspace({
      path: '/tmp/rel-ws',
      database: '/db/x.sqlite'
    });
    expect(mod.getAvailableWorkspaces()).toEqual([
      {
        path: path.resolve('/tmp/rel-ws'),
        database: '/db/x.sqlite',
        pid: process.pid,
        version: 'dynamic'
      }
    ]);
  });

  test('registering the same path twice keeps a single entry', async () => {
    const mod = await freshModule();
    mod.registerWorkspace({ path: '/ws/a', database: '/db/a.sqlite' });
    mod.registerWorkspace({ path: '/ws/a', database: '/db/b.sqlite' });
    const entries = mod.getAvailableWorkspaces();
    expect(entries).toHaveLength(1);
    expect(entries[0].database).toBe('/db/b.sqlite');
  });

  test('lists every registered workspace', async () => {
    const mod = await freshModule();
    mod.registerWorkspace({ path: '/ws/a', database: '/db/a.sqlite' });
    mod.registerWorkspace({ path: '/ws/b', database: '/db/b.sqlite' });
    expect(mod.getAvailableWorkspaces().map((w) => w.path)).toEqual([
      '/ws/a',
      '/ws/b'
    ]);
  });
});
