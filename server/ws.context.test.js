import { describe, expect, test } from 'vitest';
import {
  ensureSubs,
  getCurrentWorkspace,
  getDbWatcher,
  getWss,
  nextListRevision,
  setCurrentWorkspace,
  setDbWatcher,
  setWss
} from './ws/context.js';

/**
 * Stand-in socket object keyed by identity in the module's WeakMap.
 *
 * @param {string} name
 */
function fakeSocket(name) {
  return { name };
}

describe('ws connection context', () => {
  test('ensureSubs creates one state per socket and reuses it', () => {
    const a = /** @type {any} */ (fakeSocket('a'));
    const a_again = /** @type {any} */ (fakeSocket('a'));
    const b = /** @type {any} */ (fakeSocket('b'));

    const s1 = ensureSubs(a);
    expect(s1).toEqual({
      show_id: null,
      list_subs: new Map(),
      list_revisions: new Map()
    });

    // Same socket object returns the same state object.
    expect(ensureSubs(a)).toBe(s1);

    // A different socket gets its own state.
    const s2 = ensureSubs(b);
    expect(s2).not.toBe(s1);

    // Equal-looking but distinct objects are distinct sockets.
    expect(ensureSubs(a_again)).not.toBe(s1);
  });

  test('nextListRevision counts monotonically per key and per socket', () => {
    const a = /** @type {any} */ (fakeSocket('rev-a'));
    const b = /** @type {any} */ (fakeSocket('rev-b'));

    expect(nextListRevision(a, 'list:issues')).toBe(1);
    expect(nextListRevision(a, 'list:issues')).toBe(2);
    expect(nextListRevision(a, 'list:issues')).toBe(3);

    // Other keys on the same socket count independently.
    expect(nextListRevision(a, 'list:epics')).toBe(1);

    // Other sockets count independently.
    expect(nextListRevision(b, 'list:issues')).toBe(1);
  });

  test('wss, workspace, and db watcher round-trip through the module state', () => {
    const wss = /** @type {any} */ ({ name: 'wss' });
    setWss(wss);
    expect(getWss()).toBe(wss);

    const workspace = { root_dir: '/repo/x', db_path: '/repo/x/.beads/x.db' };
    setCurrentWorkspace(workspace);
    expect(getCurrentWorkspace()).toBe(workspace);

    const watcher = /** @type {any} */ ({
      rebind: () => {},
      path: '/repo/x/.beads/x.db'
    });
    setDbWatcher(watcher);
    expect(getDbWatcher()).toBe(watcher);
  });
});
