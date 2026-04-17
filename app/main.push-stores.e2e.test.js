import { describe, expect, test, vi } from 'vitest';
import { bootstrap } from './main.js';
import { createWsClient } from './ws.js';

// Mock WS client to drive push envelopes and connection state
vi.mock('./ws.js', () => {
  /** @type {Record<string, (p: any) => void>} */
  const handlers = {};
  /** @type {Set<(s: 'connecting'|'open'|'closed'|'reconnecting') => void>} */
  const connHandlers = new Set();
  const singleton = {
    /**
     * @param {import('./protocol.js').MessageType} type
     * @param {any} payload
     */
    async send(type, payload) {
      // Subscriptions are fire-and-forget in tests
      void type;
      void payload;
      return null;
    },
    /**
     * @param {import('./protocol.js').MessageType} type
     * @param {(p:any)=>void} handler
     */
    on(type, handler) {
      handlers[type] = handler;
      return () => {
        delete handlers[type];
      };
    },
    /** Test helper: trigger a server event */
    /**
     * @param {import('./protocol.js').MessageType} type
     * @param {any} payload
     */
    _trigger(type, payload) {
      if (handlers[type]) {
        handlers[type](payload);
      }
    },
    /**
     * @param {(s:'connecting'|'open'|'closed'|'reconnecting')=>void} fn
     */
    onConnection(fn) {
      connHandlers.add(fn);
      return () => connHandlers.delete(fn);
    },
    /** Test helper: emit connection state */
    /** @param {'connecting'|'open'|'closed'|'reconnecting'} s */
    _emitConn(s) {
      for (const fn of Array.from(connHandlers)) {
        try {
          fn(s);
        } catch {
          /* ignore */
        }
      }
    },
    close() {},
    getState() {
      return 'open';
    }
  };
  return { createWsClient: () => singleton };
});

describe('push stores integration (board view)', () => {
  test('updates columns from unified board subscription on push events', async () => {
    const client = /** @type {any} */ (createWsClient());
    window.location.hash = '#/board';
    document.body.innerHTML = '<main id="app"></main>';
    const root = /** @type {HTMLElement} */ (document.getElementById('app'));

    bootstrap(root);
    // Allow router + subscriptions to wire
    await Promise.resolve();

    // Initial board: no cards
    expect(document.querySelectorAll('#ready-col .board-card').length).toBe(0);
    expect(
      document.querySelectorAll('#in-progress-col .board-card').length
    ).toBe(0);

    // Send unified board snapshot with _board_column tags
    client._trigger('snapshot', {
      type: 'snapshot',
      id: 'tab:board',
      revision: 1,
      issues: [
        {
          id: 'R-1',
          title: 'ready 1',
          priority: 1,
          updated_at: 10_000,
          _board_column: 'ready'
        },
        {
          id: 'R-2',
          title: 'ready 2',
          priority: 2,
          updated_at: 11_000,
          _board_column: 'ready'
        },
        {
          id: 'P-1',
          title: 'prog 1',
          updated_at: 20_000,
          _board_column: 'in_progress'
        }
      ]
    });
    await Promise.resolve();

    // Verify columns reflect their data
    expect(document.querySelectorAll('#ready-col .board-card').length).toBe(2);
    expect(
      document.querySelectorAll('#in-progress-col .board-card').length
    ).toBe(1);

    // Upsert: new ready item
    client._trigger('upsert', {
      type: 'upsert',
      id: 'tab:board',
      revision: 2,
      issue: {
        id: 'R-3',
        title: 'ready 3',
        priority: 1,
        updated_at: 12_000,
        _board_column: 'ready'
      }
    });
    await Promise.resolve();

    expect(document.querySelectorAll('#ready-col .board-card').length).toBe(3);
    // In-progress unaffected
    expect(
      document.querySelectorAll('#in-progress-col .board-card').length
    ).toBe(1);

    // Delete in-progress item
    client._trigger('delete', {
      type: 'delete',
      id: 'tab:board',
      revision: 3,
      issue_id: 'P-1'
    });
    await Promise.resolve();

    expect(
      document.querySelectorAll('#in-progress-col .board-card').length
    ).toBe(0);
    // Ready unaffected
    expect(document.querySelectorAll('#ready-col .board-card').length).toBe(3);
  });

  test('reconnect replay does not duplicate entries', async () => {
    const client = /** @type {any} */ (createWsClient());
    window.location.hash = '#/board';
    document.body.innerHTML = '<main id="app"></main>';
    const root = /** @type {HTMLElement} */ (document.getElementById('app'));

    bootstrap(root);
    await Promise.resolve();

    // Initial snapshot
    client._trigger('snapshot', {
      type: 'snapshot',
      id: 'tab:board',
      revision: 1,
      issues: [
        {
          id: 'R-1',
          title: 'r1',
          priority: 1,
          updated_at: 10_000,
          _board_column: 'ready'
        },
        {
          id: 'R-2',
          title: 'r2',
          priority: 2,
          updated_at: 10_100,
          _board_column: 'ready'
        }
      ]
    });
    await Promise.resolve();
    expect(document.querySelectorAll('#ready-col .board-card').length).toBe(2);

    // Simulate reconnect cycle and server replaying the same snapshot
    client._emitConn('reconnecting');
    client._emitConn('open');
    client._trigger('snapshot', {
      type: 'snapshot',
      id: 'tab:board',
      revision: 1,
      issues: [
        {
          id: 'R-1',
          title: 'r1',
          priority: 1,
          updated_at: 10_000,
          _board_column: 'ready'
        },
        {
          id: 'R-2',
          title: 'r2',
          priority: 2,
          updated_at: 10_100,
          _board_column: 'ready'
        }
      ]
    });
    await Promise.resolve();
    // Still exactly two cards; no duplicates
    expect(document.querySelectorAll('#ready-col .board-card').length).toBe(2);

    // Newer upsert after replay updates item without duplication
    client._trigger('upsert', {
      type: 'upsert',
      id: 'tab:board',
      revision: 2,
      issue: {
        id: 'R-2',
        title: 'r2!',
        priority: 2,
        updated_at: 10_200,
        _board_column: 'ready'
      }
    });
    await Promise.resolve();
    expect(document.querySelectorAll('#ready-col .board-card').length).toBe(2);
  });
});
