import { describe, expect, test, vi } from 'vitest';
import { createWorkspacePicker } from './workspace-picker.js';

/**
 * @param {any} initial_state
 */
function makeStore(initial_state) {
  /** @type {any} */
  let state = initial_state;
  /** @type {Array<(s: any) => void>} */
  const listeners = [];
  return {
    getState: () => state,
    setState(/** @type {any} */ next) {
      state = next;
      for (const fn of listeners) {
        fn(state);
      }
    },
    subscribe(/** @type {(s: any) => void} */ fn) {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i >= 0) {
          listeners.splice(i, 1);
        }
      };
    }
  };
}

/**
 * @param {string} current
 * @param {string[]} paths
 */
function stateWith(current, paths) {
  return {
    workspace: {
      current: { path: current },
      available: paths.map((p) => ({ path: p }))
    }
  };
}

function mount() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('workspace picker', () => {
  test('renders nothing when no workspaces are available', () => {
    const el = mount();
    createWorkspacePicker(el, makeStore({ workspace: null }), vi.fn());
    expect(el.children).toHaveLength(0);
  });

  test('renders a single workspace as a label with the project name', () => {
    const el = mount();
    createWorkspacePicker(
      el,
      makeStore(
        stateWith('/home/u/code/myproject', ['/home/u/code/myproject'])
      ),
      vi.fn()
    );
    const label = el.querySelector('.workspace-picker__label');
    expect(label).toBeTruthy();
    expect(label?.textContent).toBe('myproject');
    expect(label?.getAttribute('title')).toBe('/home/u/code/myproject');
    expect(el.querySelector('.workspace-picker--single')).toBeTruthy();
    expect(el.querySelector('select')).toBeNull();
  });

  test('renders multiple workspaces as a select with the current one selected', () => {
    const el = mount();
    createWorkspacePicker(
      el,
      makeStore(stateWith('/w/beta', ['/w/alpha', '/w/beta', '/w/gamma'])),
      vi.fn()
    );
    const select = /** @type {HTMLSelectElement} */ (
      el.querySelector('select.workspace-picker__select')
    );
    expect(select.getAttribute('aria-label')).toBe('Select project workspace');
    const options = Array.from(select.options);
    expect(options.map((o) => o.value)).toEqual([
      '/w/alpha',
      '/w/beta',
      '/w/gamma'
    ]);
    expect(options.map((o) => (o.textContent || '').trim())).toEqual([
      'alpha',
      'beta',
      'gamma'
    ]);
    expect(select.selectedIndex).toBe(1);
  });

  test('re-renders when the store notifies', () => {
    const el = mount();
    const store = makeStore(stateWith('/w/alpha', ['/w/alpha']));
    createWorkspacePicker(el, store, vi.fn());
    expect(el.querySelector('select')).toBeNull();

    store.setState(stateWith('/w/alpha', ['/w/alpha', '/w/beta']));
    expect(el.querySelector('select')).toBeTruthy();
  });

  test('switching disables the select and shows a spinner until settled', async () => {
    const el = mount();
    /** @type {(v: void) => void} */
    let resolve_switch = () => {};
    const on_change = vi.fn(
      () =>
        new Promise((resolve) => {
          resolve_switch = resolve;
        })
    );
    createWorkspacePicker(
      el,
      makeStore(stateWith('/w/alpha', ['/w/alpha', '/w/beta'])),
      on_change
    );
    const select = /** @type {HTMLSelectElement} */ (
      el.querySelector('select')
    );

    select.value = '/w/beta';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(on_change).toHaveBeenCalledWith('/w/beta');
    expect(select.disabled).toBe(true);
    expect(el.querySelector('.workspace-picker__loading')).toBeTruthy();

    resolve_switch();
    await vi.waitFor(() => {
      if (select.disabled) {
        throw new Error('still switching');
      }
    });
    expect(el.querySelector('.workspace-picker__loading')).toBeNull();
  });

  test('does not switch when the selected path is the current one', async () => {
    const el = mount();
    const on_change = vi.fn(async () => {});
    createWorkspacePicker(
      el,
      makeStore(stateWith('/w/alpha', ['/w/alpha', '/w/beta'])),
      on_change
    );
    const select = /** @type {HTMLSelectElement} */ (
      el.querySelector('select')
    );

    select.value = '/w/alpha';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();

    expect(on_change).not.toHaveBeenCalled();
    expect(select.disabled).toBe(false);
  });

  test('re-enables the select even when the switch fails', async () => {
    const el = mount();
    const on_change = vi.fn(async () => {
      throw new Error('boom');
    });
    createWorkspacePicker(
      el,
      makeStore(stateWith('/w/alpha', ['/w/alpha', '/w/beta'])),
      on_change
    );
    const select = /** @type {HTMLSelectElement} */ (
      el.querySelector('select')
    );

    select.value = '/w/beta';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => {
      if (select.disabled) {
        throw new Error('still switching');
      }
    });
    expect(el.querySelector('.workspace-picker__loading')).toBeNull();
  });

  test('destroy unsubscribes and clears the mount', () => {
    const el = mount();
    const store = makeStore(stateWith('/w/alpha', ['/w/alpha']));
    const picker = createWorkspacePicker(el, store, vi.fn());
    expect(el.querySelector('.workspace-picker__label')).toBeTruthy();

    picker.destroy();
    expect(el.querySelector('.workspace-picker')).toBeNull();

    // A later store notification must not re-render into the dead mount.
    store.setState(stateWith('/w/alpha', ['/w/alpha', '/w/beta']));
    expect(el.querySelector('.workspace-picker')).toBeNull();
  });
});
