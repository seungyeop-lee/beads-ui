import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Mutable fake HOME so the registry file lives inside a per-test tmp dir.
 */
const state = vi.hoisted(() => ({ home: '' }));

vi.mock('node:os', async (importOriginal) => {
  const actual = /** @type {typeof os} */ (await importOriginal());
  return {
    default: { ...actual, homedir: () => state.home },
    homedir: () => state.home
  };
});

/** @type {string} */
let tmp_home;

/**
 * Write the file-based registry (~/.beads/registry.json) inside the fake home.
 *
 * @param {unknown} data
 */
function writeRegistry(data) {
  fs.mkdirSync(path.join(tmp_home, '.beads'), { recursive: true });
  fs.writeFileSync(
    path.join(tmp_home, '.beads', 'registry.json'),
    JSON.stringify(data)
  );
}

/**
 * Freshly import the module so its in-memory registry starts empty.
 *
 * @returns {Promise<typeof import('./registry-watcher.js')>}
 */
function freshModule() {
  return import('./registry-watcher.js');
}

beforeEach(() => {
  vi.resetModules();
  tmp_home = fs.mkdtempSync(path.join(os.tmpdir(), 'bdui-reg-home-'));
  state.home = tmp_home;
});

afterEach(() => {
  fs.rmSync(tmp_home, { recursive: true, force: true });
});

describe('in-memory workspace registry', () => {
  test('registerWorkspace stores resolved path with pid and dynamic version', async () => {
    const mod = await freshModule();
    mod.registerWorkspace({
      path: path.join(tmp_home, 'rel-ws'),
      database: '/db/x.sqlite'
    });
    expect(mod.getInMemoryWorkspaces()).toEqual([
      {
        path: path.resolve(path.join(tmp_home, 'rel-ws')),
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
    const entries = mod.getInMemoryWorkspaces();
    expect(entries).toHaveLength(1);
    expect(entries[0].database).toBe('/db/b.sqlite');
  });

  test('getRegistryPath points at ~/.beads/registry.json', async () => {
    const mod = await freshModule();
    expect(mod.getRegistryPath()).toBe(
      path.join(tmp_home, '.beads', 'registry.json')
    );
  });
});

describe('readRegistry', () => {
  test('returns the parsed array verbatim', async () => {
    writeRegistry([
      {
        workspace_path: '/ws/a',
        socket_path: '/sock/a',
        database_path: '/db/a.sqlite',
        pid: 1,
        version: '0.1.0',
        started_at: '2026-10-10T00:00:00Z'
      }
    ]);
    const mod = await freshModule();
    expect(mod.readRegistry()).toEqual([
      {
        workspace_path: '/ws/a',
        socket_path: '/sock/a',
        database_path: '/db/a.sqlite',
        pid: 1,
        version: '0.1.0',
        started_at: '2026-10-10T00:00:00Z'
      }
    ]);
  });

  test('returns empty array for non-array JSON, broken JSON, and missing file', async () => {
    writeRegistry({ not: 'an array' });
    const mod = await freshModule();
    expect(mod.readRegistry()).toEqual([]);

    fs.writeFileSync(path.join(tmp_home, '.beads', 'registry.json'), '{broken');
    expect(mod.readRegistry()).toEqual([]);

    fs.rmSync(path.join(tmp_home, '.beads', 'registry.json'));
    expect(mod.readRegistry()).toEqual([]);
  });
});

describe('findWorkspaceEntry', () => {
  const entry = {
    workspace_path: '/ws/alpha',
    socket_path: '/sock/alpha',
    database_path: '/db/alpha.sqlite',
    pid: 1,
    version: '0.1.0',
    started_at: '2026-10-10T00:00:00Z'
  };

  beforeEach(() => {
    writeRegistry([entry]);
  });

  test('matches the workspace root exactly', async () => {
    const mod = await freshModule();
    expect(mod.findWorkspaceEntry('/ws/alpha')).toEqual(entry);
  });

  test('matches directories inside the workspace but not sibling prefixes', async () => {
    const mod = await freshModule();
    expect(mod.findWorkspaceEntry(path.join('/ws', 'alpha', 'sub', 'deep'))) //
      .toEqual(entry);
    // A sibling whose name merely starts with the workspace name must not match.
    expect(mod.findWorkspaceEntry('/ws/alphabeta')).toBeNull();
  });

  test('returns null outside any workspace', async () => {
    const mod = await freshModule();
    expect(mod.findWorkspaceEntry('/ws/beta')).toBeNull();
  });
});

describe('getAvailableWorkspaces', () => {
  test('maps file entries and appends in-memory ones, deduping by path', async () => {
    writeRegistry([
      {
        workspace_path: '/ws/a',
        socket_path: '/sock/a',
        database_path: '/db/a.sqlite',
        pid: 11,
        version: '0.1.0',
        started_at: '2026-10-10T00:00:00Z'
      }
    ]);
    const mod = await freshModule();
    // Same path as the file entry: the file entry wins.
    mod.registerWorkspace({ path: '/ws/a', database: '/db/dynamic-a.sqlite' });
    // New path: appended after the file workspaces.
    mod.registerWorkspace({ path: '/ws/b', database: '/db/dynamic-b.sqlite' });

    expect(mod.getAvailableWorkspaces()).toEqual([
      { path: '/ws/a', database: '/db/a.sqlite', pid: 11, version: '0.1.0' },
      {
        path: '/ws/b',
        database: '/db/dynamic-b.sqlite',
        pid: process.pid,
        version: 'dynamic'
      }
    ]);
  });
});

describe('watchRegistry', () => {
  test('debounces registry file changes and passes parsed entries', async () => {
    writeRegistry([
      {
        workspace_path: '/ws/a',
        socket_path: '/sock/a',
        database_path: '/db/a.sqlite',
        pid: 1,
        version: '0.1.0',
        started_at: '2026-10-10T00:00:00Z'
      }
    ]);
    const mod = await freshModule();
    /** @type {any[][]} */
    const calls = [];
    const watcher = mod.watchRegistry((entries) => calls.push(entries), {
      debounce_ms: 15
    });

    // Two rapid writes collapse into one debounced callback.
    const file = path.join(tmp_home, '.beads', 'registry.json');
    fs.writeFileSync(file, JSON.stringify([{ workspace_path: '/w/1' }]));
    fs.writeFileSync(file, JSON.stringify([{ workspace_path: '/w/2' }]));

    await vi.waitFor(
      () => {
        if (calls.length === 0) {
          throw new Error('no callback yet');
        }
      },
      { timeout: 5000, interval: 50 }
    );
    watcher.close();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([{ workspace_path: '/w/2' }]);
  });

  test('schedules only for registry file events, passing null filenames through', async () => {
    writeRegistry([]);
    const mod = await freshModule();

    /** @type {(event_type: string, filename: string | null) => void} */
    let emit = () => {};
    const watch_spy = vi.spyOn(fs, 'watch').mockImplementation(
      /** @type {any} */ (
        /** @param {any[]} args */
        (...args) => {
          emit = args[args.length - 1];
          return { close: () => {} };
        }
      )
    );

    /** @type {any[][]} */
    const calls = [];
    vi.useFakeTimers();
    try {
      mod.watchRegistry((entries) => calls.push(entries), {
        debounce_ms: 500
      });

      // Named events for other files, and unrelated event types, are ignored.
      emit('change', 'other.json');
      emit('rename', 'unrelated.txt');
      emit('other', 'registry.json');
      vi.advanceTimersByTime(2000);
      expect(calls).toHaveLength(0);

      // Rapid registry events collapse into one debounced callback.
      emit('change', 'registry.json');
      emit('rename', 'registry.json');
      vi.advanceTimersByTime(2000);
      expect(calls).toHaveLength(1);

      // A null filename (platforms without per-file attribution) passes
      // through conservatively.
      emit('change', null);
      vi.advanceTimersByTime(2000);
      expect(calls).toHaveLength(2);
    } finally {
      vi.useRealTimers();
      watch_spy.mockRestore();
    }
  });

  test('returns an inert closer when the registry directory is missing', async () => {
    const mod = await freshModule();
    /** @type {any[][]} */
    const calls = [];
    const watcher = mod.watchRegistry((entries) => calls.push(entries));
    expect(() => watcher.close()).not.toThrow();
    expect(calls).toHaveLength(0);
  });
});
