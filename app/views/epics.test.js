import { describe, expect, test, vi } from 'vitest';
import { createSubscriptionIssueStore } from '../data/subscription-issue-store.js';
import { createSubscriptionStore } from '../data/subscriptions-store.js';
import { createEpicsView } from './epics.js';

describe('views/epics', () => {
  test('loads groups from store and expands to show non-closed children, navigates on click', async () => {
    document.body.innerHTML = '<div id="m"></div>';
    const mount = /** @type {HTMLElement} */ (document.getElementById('m'));
    const data = {
      updateIssue: vi.fn(),
      getIssue: vi.fn(async (id) => ({ id }))
    };
    /** test issue stores */
    const stores = new Map();
    const listeners = new Set();
    /** @param {string} id */
    const getStore = (id) => {
      let s = stores.get(id);
      if (!s) {
        s = createSubscriptionIssueStore(id);
        stores.set(id, s);
        s.subscribe(() => {
          for (const fn of Array.from(listeners)) {
            try {
              fn();
            } catch {
              /* ignore */
            }
          }
        });
      }
      return s;
    };
    const issueStores = {
      getStore,
      /** @param {string} id */
      snapshotFor(id) {
        return getStore(id).snapshot().slice();
      },
      /** @param {() => void} fn */
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      }
    };
    const subscriptions = createSubscriptionStore(async () => {});
    // Seed epics list snapshot
    issueStores.getStore('tab:epics').applyPush({
      type: 'snapshot',
      id: 'tab:epics',
      revision: 1,
      issues: [
        {
          id: 'UI-1',
          title: 'Epic One',
          issue_type: 'epic',
          dependents: [{ id: 'UI-2' }, { id: 'UI-3' }]
        }
      ]
    });
    /** @type {string[]} */
    const navCalls = [];
    const view = createEpicsView(
      mount,
      /** @type {any} */ (data),
      (id) => navCalls.push(id),
      subscriptions,
      /** @type {any} */ (issueStores)
    );
    await view.load();
    // Register epic detail and push snapshot with dependents
    issueStores.getStore('detail:UI-1');
    issueStores.getStore('detail:UI-1').applyPush({
      type: 'snapshot',
      id: 'detail:UI-1',
      revision: 1,
      issues: [
        {
          id: 'UI-1',
          title: 'Epic One',
          issue_type: 'epic',
          dependents: [
            {
              id: 'UI-2',
              title: 'Alpha',
              status: 'open',
              priority: 1,
              issue_type: 'task'
            },
            {
              id: 'UI-3',
              title: 'Beta',
              status: 'closed',
              priority: 2,
              issue_type: 'task'
            }
          ]
        }
      ]
    });
    await view.load();
    const header = mount.querySelector('.epic-header');
    expect(header).not.toBeNull();
    // After expansion, only non-closed child should be present
    const rows = mount.querySelectorAll('tr.epic-row');
    expect(rows.length).toBe(2);
    rows[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(navCalls[0]).toBe('UI-2');
  });

  test('sorts children by priority then created_at asc', async () => {
    document.body.innerHTML = '<div id="m"></div>';
    const mount = /** @type {HTMLElement} */ (document.getElementById('m'));
    const data = {
      updateIssue: vi.fn(),
      getIssue: vi.fn(async (id) => ({ id }))
    };
    const stores2 = new Map();
    const listeners2 = new Set();
    /** @param {string} id */
    const getStore2 = (id) => {
      let s = stores2.get(id);
      if (!s) {
        s = createSubscriptionIssueStore(id);
        stores2.set(id, s);
        s.subscribe(() => {
          for (const fn of Array.from(listeners2)) {
            try {
              fn();
            } catch {
              /* ignore */
            }
          }
        });
      }
      return s;
    };
    const issueStores2 = {
      getStore: getStore2,
      /** @param {string} id */
      snapshotFor(id) {
        return getStore2(id).snapshot().slice();
      },
      /** @param {() => void} fn */
      subscribe(fn) {
        listeners2.add(fn);
        return () => listeners2.delete(fn);
      }
    };
    const subscriptions = createSubscriptionStore(async () => {});
    // seed epics snapshot
    issueStores2.getStore('tab:epics').applyPush({
      type: 'snapshot',
      id: 'tab:epics',
      revision: 1,
      issues: [
        {
          id: 'UI-10',
          title: 'Epic Sort',
          issue_type: 'epic',
          dependents: [{ id: 'UI-11' }, { id: 'UI-12' }, { id: 'UI-13' }]
        }
      ]
    });
    const view = createEpicsView(
      mount,
      /** @type {any} */ (data),
      () => {},
      subscriptions,
      /** @type {any} */ (issueStores2)
    );
    await view.load();
    // Seed epic detail snapshot for UI-10 with out-of-order dependents
    issueStores2.getStore('detail:UI-10');
    issueStores2.getStore('detail:UI-10').applyPush({
      type: 'snapshot',
      id: 'detail:UI-10',
      revision: 1,
      issues: [
        {
          id: 'UI-10',
          title: 'Epic Sort',
          issue_type: 'epic',
          dependents: [
            {
              id: 'UI-11',
              title: 'Low priority, newest within p1',
              status: 'open',
              priority: 1,
              issue_type: 'task',
              created_at: '2025-10-22T10:00:00.000Z',
              updated_at: '2025-10-22T10:00:00.000Z'
            },
            {
              id: 'UI-12',
              title: 'Low priority, older',
              status: 'open',
              priority: 1,
              issue_type: 'task',
              created_at: '2025-10-20T10:00:00.000Z',
              updated_at: '2025-10-20T10:00:00.000Z'
            },
            {
              id: 'UI-13',
              title: 'Higher priority number (lower precedence)',
              status: 'open',
              priority: 2,
              issue_type: 'task',
              created_at: '2025-10-23T10:00:00.000Z',
              updated_at: '2025-10-23T10:00:00.000Z'
            }
          ]
        }
      ]
    });
    await view.load();
    const rows = Array.from(mount.querySelectorAll('tr.epic-row'));
    const ids = rows.map((r) =>
      /** @type {HTMLElement} */ (
        r.querySelector('td.mono')
      )?.textContent?.trim()
    );
    expect(ids).toEqual(['UI-12', 'UI-11', 'UI-13']);
  });

  test('clicking inputs/selects inside a row does not navigate', async () => {
    document.body.innerHTML = '<div id="m"></div>';
    const mount = /** @type {HTMLElement} */ (document.getElementById('m'));
    const data = {
      updateIssue: vi.fn(),
      getIssue: vi.fn(async (id) => ({ id }))
    };
    const stores3 = new Map();
    const listeners3 = new Set();
    /** @param {string} id */
    const getStore3 = (id) => {
      let s = stores3.get(id);
      if (!s) {
        s = createSubscriptionIssueStore(id);
        stores3.set(id, s);
        s.subscribe(() => {
          for (const fn of Array.from(listeners3)) {
            try {
              fn();
            } catch {
              /* ignore */
            }
          }
        });
      }
      return s;
    };
    const issueStores3 = {
      getStore: getStore3,
      /** @param {string} id */
      snapshotFor(id) {
        return getStore3(id).snapshot().slice();
      },
      /** @param {() => void} fn */
      subscribe(fn) {
        listeners3.add(fn);
        return () => listeners3.delete(fn);
      }
    };
    const subscriptions = createSubscriptionStore(async () => {});
    issueStores3.getStore('tab:epics').applyPush({
      type: 'snapshot',
      id: 'tab:epics',
      revision: 1,
      issues: [
        {
          id: 'UI-20',
          title: 'Epic Click Guard',
          issue_type: 'epic',
          dependents: [{ id: 'UI-21' }]
        }
      ]
    });
    /** @type {string[]} */
    const navCalls = [];
    const view = createEpicsView(
      mount,
      /** @type {any} */ (data),
      (id) => navCalls.push(id),
      subscriptions,
      /** @type {any} */ (issueStores3)
    );
    await view.load();
    // Provide detail snapshot so a child row exists
    issueStores3.getStore('detail:UI-20');
    issueStores3.getStore('detail:UI-20').applyPush({
      type: 'snapshot',
      id: 'detail:UI-20',
      revision: 1,
      issues: [
        {
          id: 'UI-20',
          title: 'Epic Click Guard',
          issue_type: 'epic',
          dependents: [
            {
              id: 'UI-21',
              title: 'Row',
              status: 'open',
              priority: 2,
              issue_type: 'task'
            }
          ]
        }
      ]
    });
    await view.load();
    // Click a select inside the row; should not navigate
    const sel = /** @type {HTMLSelectElement|null} */ (
      mount.querySelector('tr.epic-row select')
    );
    sel?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(navCalls.length).toBe(0);
  });

  test('shows Loading… while fetching children on manual expansion (no flicker)', async () => {
    document.body.innerHTML = '<div id="m"></div>';
    const mount = /** @type {HTMLElement} */ (document.getElementById('m'));
    const data = {
      updateIssue: vi.fn(),
      getIssue: vi.fn(async (id) => ({ id }))
    };
    const stores4 = new Map();
    const listeners4 = new Set();
    /** @param {string} id */
    const getStore4 = (id) => {
      let s = stores4.get(id);
      if (!s) {
        s = createSubscriptionIssueStore(id);
        stores4.set(id, s);
        s.subscribe(() => {
          for (const fn of Array.from(listeners4)) {
            try {
              fn();
            } catch {
              /* ignore */
            }
          }
        });
      }
      return s;
    };
    const issueStores4 = {
      getStore: getStore4,
      /** @param {string} id */
      snapshotFor(id) {
        return getStore4(id).snapshot().slice();
      },
      /** @param {() => void} fn */
      subscribe(fn) {
        listeners4.add(fn);
        return () => listeners4.delete(fn);
      }
    };
    const subscriptions = createSubscriptionStore(async () => {});
    issueStores4.getStore('tab:epics').applyPush({
      type: 'snapshot',
      id: 'tab:epics',
      revision: 1,
      issues: [
        {
          id: 'UI-40',
          title: 'Auto Expanded',
          issue_type: 'epic',
          dependents: []
        },
        {
          id: 'UI-41',
          title: 'Manual Expand',
          issue_type: 'epic',
          dependents: [{ id: 'UI-42' }]
        }
      ]
    });
    const view = createEpicsView(
      mount,
      /** @type {any} */ (data),
      () => {},
      subscriptions,
      /** @type {any} */ (issueStores4)
    );
    await view.load();
    // Expand the second group manually
    const groups = Array.from(mount.querySelectorAll('.epic-group'));
    const manual = groups.find(
      (g) => g.getAttribute('data-epic-id') === 'UI-41'
    );
    expect(manual).toBeDefined();
    manual
      ?.querySelector('.epic-toggle-btn')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // Immediately after click, expect Loading…
    const text = manual?.querySelector('.epic-children')?.textContent || '';
    expect(text.includes('Loading…')).toBe(true);
    // Provide epic detail snapshot (no rendering assertion here)
    issueStores4.getStore('detail:UI-41');
    issueStores4.getStore('detail:UI-41').applyPush({
      type: 'snapshot',
      id: 'detail:UI-41',
      revision: 1,
      issues: [
        {
          id: 'UI-41',
          title: 'Epic Manual',
          issue_type: 'epic',
          dependents: [
            {
              id: 'UI-42',
              title: 'Child',
              status: 'open',
              priority: 2,
              issue_type: 'task'
            }
          ]
        }
      ]
    });
    // Verify mapping via store presence
    const d = issueStores4.snapshotFor('detail:UI-41');
    expect(d.length).toBe(1);
    expect(d[0]?.id).toBe('UI-41');
  });

  test('clicking epic title navigates to the epic detail', async () => {
    document.body.innerHTML = '<div id="m"></div>';
    const mount = /** @type {HTMLElement} */ (document.getElementById('m'));
    const data = {
      updateIssue: vi.fn(),
      getIssue: vi.fn(async (id) => ({ id }))
    };
    const storesN = new Map();
    const listenersN = new Set();
    /** @param {string} id */
    const getStoreN = (id) => {
      let s = storesN.get(id);
      if (!s) {
        s = createSubscriptionIssueStore(id);
        storesN.set(id, s);
        s.subscribe(() => {
          for (const fn of Array.from(listenersN)) {
            try {
              fn();
            } catch {
              /* ignore */
            }
          }
        });
      }
      return s;
    };
    const issueStoresN = {
      getStore: getStoreN,
      /** @param {string} id */
      snapshotFor(id) {
        return getStoreN(id).snapshot().slice();
      },
      /** @param {() => void} fn */
      subscribe(fn) {
        listenersN.add(fn);
        return () => listenersN.delete(fn);
      }
    };
    const subscriptionsN = createSubscriptionStore(async () => {});
    issueStoresN.getStore('tab:epics').applyPush({
      type: 'snapshot',
      id: 'tab:epics',
      revision: 1,
      issues: [
        {
          id: 'UI-50',
          title: 'Clickable Epic',
          issue_type: 'epic',
          dependents: []
        }
      ]
    });
    /** @type {string[]} */
    const navCalls = [];
    const view = createEpicsView(
      mount,
      /** @type {any} */ (data),
      (id) => navCalls.push(id),
      subscriptionsN,
      /** @type {any} */ (issueStoresN)
    );
    await view.load();
    const titleEl = /** @type {HTMLElement|null} */ (
      mount.querySelector('.epic-group[data-epic-id="UI-50"] .epic-title-text')
    );
    expect(titleEl).not.toBeNull();
    titleEl?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(navCalls).toEqual(['UI-50']);
    // Clicking the surrounding .epic-title flex container (outside the text)
    // must not navigate — it is for toggling via header click.
    const titleWrap = /** @type {HTMLElement|null} */ (
      mount.querySelector('.epic-group[data-epic-id="UI-50"] .epic-title')
    );
    titleWrap?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // Only the direct click on .epic-title-text above registered.
    expect(navCalls).toEqual(['UI-50']);
  });

  test('clicking header bar background toggles expanded state (not navigate)', async () => {
    document.body.innerHTML = '<div id="m"></div>';
    const mount = /** @type {HTMLElement} */ (document.getElementById('m'));
    const data = {
      updateIssue: vi.fn(),
      getIssue: vi.fn(async (id) => ({ id }))
    };
    const storesH = new Map();
    const listenersH = new Set();
    /** @param {string} id */
    const getStoreH = (id) => {
      let s = storesH.get(id);
      if (!s) {
        s = createSubscriptionIssueStore(id);
        storesH.set(id, s);
        s.subscribe(() => {
          for (const fn of Array.from(listenersH)) {
            try {
              fn();
            } catch {
              /* ignore */
            }
          }
        });
      }
      return s;
    };
    const issueStoresH = {
      getStore: getStoreH,
      /** @param {string} id */
      snapshotFor(id) {
        return getStoreH(id).snapshot().slice();
      },
      /** @param {() => void} fn */
      subscribe(fn) {
        listenersH.add(fn);
        return () => listenersH.delete(fn);
      }
    };
    const subscriptionsH = createSubscriptionStore(async () => {});
    issueStoresH.getStore('tab:epics').applyPush({
      type: 'snapshot',
      id: 'tab:epics',
      revision: 1,
      issues: [
        {
          id: 'UI-70',
          title: 'First',
          issue_type: 'epic',
          dependents: []
        },
        {
          id: 'UI-71',
          title: 'Bar Target',
          issue_type: 'epic',
          dependents: [{ id: 'UI-72' }]
        }
      ]
    });
    /** @type {string[]} */
    const navCalls = [];
    const view = createEpicsView(
      mount,
      /** @type {any} */ (data),
      (id) => navCalls.push(id),
      subscriptionsH,
      /** @type {any} */ (issueStoresH)
    );
    await view.load();
    const target = /** @type {HTMLElement|null} */ (
      mount.querySelector('.epic-group[data-epic-id="UI-71"]')
    );
    const header = /** @type {HTMLElement|null} */ (
      target?.querySelector('.epic-header')
    );
    expect(header).not.toBeNull();
    expect(target?.querySelector('.epic-children')).toBeNull();
    header?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(target?.querySelector('.epic-children')).not.toBeNull();
    expect(
      target?.querySelector('.epic-toggle-btn')?.getAttribute('aria-expanded')
    ).toBe('true');
    expect(navCalls.length).toBe(0);
  });

  test('toggle button toggles expanded state and aria-expanded', async () => {
    document.body.innerHTML = '<div id="m"></div>';
    const mount = /** @type {HTMLElement} */ (document.getElementById('m'));
    const data = {
      updateIssue: vi.fn(),
      getIssue: vi.fn(async (id) => ({ id }))
    };
    const storesT = new Map();
    const listenersT = new Set();
    /** @param {string} id */
    const getStoreT = (id) => {
      let s = storesT.get(id);
      if (!s) {
        s = createSubscriptionIssueStore(id);
        storesT.set(id, s);
        s.subscribe(() => {
          for (const fn of Array.from(listenersT)) {
            try {
              fn();
            } catch {
              /* ignore */
            }
          }
        });
      }
      return s;
    };
    const issueStoresT = {
      getStore: getStoreT,
      /** @param {string} id */
      snapshotFor(id) {
        return getStoreT(id).snapshot().slice();
      },
      /** @param {() => void} fn */
      subscribe(fn) {
        listenersT.add(fn);
        return () => listenersT.delete(fn);
      }
    };
    const subscriptionsT = createSubscriptionStore(async () => {});
    // Two epics: first auto-expands, second starts collapsed.
    issueStoresT.getStore('tab:epics').applyPush({
      type: 'snapshot',
      id: 'tab:epics',
      revision: 1,
      issues: [
        {
          id: 'UI-60',
          title: 'First',
          issue_type: 'epic',
          dependents: []
        },
        {
          id: 'UI-61',
          title: 'Target',
          issue_type: 'epic',
          dependents: [{ id: 'UI-62' }]
        }
      ]
    });
    /** @type {string[]} */
    const navCalls = [];
    const view = createEpicsView(
      mount,
      /** @type {any} */ (data),
      (id) => navCalls.push(id),
      subscriptionsT,
      /** @type {any} */ (issueStoresT)
    );
    await view.load();
    const target = /** @type {HTMLElement|null} */ (
      mount.querySelector('.epic-group[data-epic-id="UI-61"]')
    );
    expect(target).not.toBeNull();
    let toggleBtn = /** @type {HTMLElement|null} */ (
      target?.querySelector('.epic-toggle-btn')
    );
    expect(toggleBtn?.getAttribute('aria-expanded')).toBe('false');
    expect(target?.querySelector('.epic-children')).toBeNull();
    // Click toggle → expanded
    toggleBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    toggleBtn = /** @type {HTMLElement|null} */ (
      target?.querySelector('.epic-toggle-btn')
    );
    expect(toggleBtn?.getAttribute('aria-expanded')).toBe('true');
    expect(target?.querySelector('.epic-children')).not.toBeNull();
    // Toggle click must not navigate.
    expect(navCalls.length).toBe(0);
    // Click toggle again → collapsed
    toggleBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    toggleBtn = /** @type {HTMLElement|null} */ (
      target?.querySelector('.epic-toggle-btn')
    );
    expect(toggleBtn?.getAttribute('aria-expanded')).toBe('false');
    expect(target?.querySelector('.epic-children')).toBeNull();
  });

  test('clicking title navigates; pencil button enters edit mode', async () => {
    document.body.innerHTML = '<div id="m"></div>';
    const mount = /** @type {HTMLElement} */ (document.getElementById('m'));
    const data = {
      updateIssue: vi.fn(),
      getIssue: vi.fn(async (id) => ({ id }))
    };
    const stores5 = new Map();
    const listeners5 = new Set();
    /** @param {string} id */
    const getStore5 = (id) => {
      let s = stores5.get(id);
      if (!s) {
        s = createSubscriptionIssueStore(id);
        stores5.set(id, s);
        s.subscribe(() => {
          for (const fn of Array.from(listeners5)) {
            try {
              fn();
            } catch {
              /* ignore */
            }
          }
        });
      }
      return s;
    };
    const issueStores5 = {
      getStore: getStore5,
      /** @param {string} id */
      snapshotFor(id) {
        return getStore5(id).snapshot().slice();
      },
      /** @param {() => void} fn */
      subscribe(fn) {
        listeners5.add(fn);
        return () => listeners5.delete(fn);
      }
    };
    const subscriptions2 = createSubscriptionStore(async () => {});
    issueStores5.getStore('tab:epics').applyPush({
      type: 'snapshot',
      id: 'tab:epics',
      revision: 1,
      issues: [
        {
          id: 'UI-30',
          title: 'Epic Title Click',
          issue_type: 'epic',
          dependents: [{ id: 'UI-31' }]
        }
      ]
    });
    /** @type {string[]} */
    const navCalls = [];
    const view = createEpicsView(
      mount,
      /** @type {any} */ (data),
      (id) => navCalls.push(id),
      subscriptions2,
      /** @type {any} */ (issueStores5)
    );
    await view.load();
    issueStores5.getStore('detail:UI-30');
    issueStores5.getStore('detail:UI-30').applyPush({
      type: 'snapshot',
      id: 'detail:UI-30',
      revision: 1,
      issues: [
        {
          id: 'UI-30',
          title: 'Epic Title Click',
          issue_type: 'epic',
          dependents: [
            {
              id: 'UI-31',
              title: 'Clickable Title',
              status: 'open',
              priority: 2,
              issue_type: 'task'
            }
          ]
        }
      ]
    });
    await view.load();
    const titleSpan = /** @type {HTMLElement|null} */ (
      mount.querySelector('tr.epic-row td:nth-child(3) .row-title')
    );
    expect(titleSpan).not.toBeNull();
    // Clicking the title text bubbles to the row and navigates to detail.
    titleSpan?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(navCalls).toEqual(['UI-31']);
    // No edit input yet
    expect(
      mount.querySelector('tr.epic-row td:nth-child(3) input[type="text"]')
    ).toBeNull();

    // Clicking the pencil button enters edit mode without navigating again.
    const editBtn = /** @type {HTMLElement|null} */ (
      mount.querySelector('tr.epic-row td:nth-child(3) .row-edit-btn')
    );
    expect(editBtn).not.toBeNull();
    editBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(navCalls).toEqual(['UI-31']);
    const input = /** @type {HTMLInputElement|null} */ (
      mount.querySelector('tr.epic-row td:nth-child(3) input[type="text"]')
    );
    expect(input).not.toBeNull();
  });
});
