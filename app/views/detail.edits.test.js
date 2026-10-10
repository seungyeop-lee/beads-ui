import { describe, expect, test, vi } from 'vitest';
import { createDetailView } from './detail.js';

/** @type {(impl: (type: string, payload?: unknown) => Promise<any>) => (type: string, payload?: unknown) => Promise<any>} */
const mockSend = (impl) => vi.fn(impl);

describe('views/detail edits', () => {
  test('updates status via dropdown and disables while pending', async () => {
    document.body.innerHTML =
      '<section class="panel"><div id="mount"></div></section>';
    const mount = /** @type {HTMLElement} */ (document.getElementById('mount'));

    const initial = {
      id: 'UI-7',
      title: 'T',
      description: 'D',
      status: 'open',
      priority: 2
    };
    const updated = { ...initial, status: 'in_progress' };

    const stores1 = {
      /** @param {string} id */
      snapshotFor(id) {
        return id === 'detail:UI-7' ? [initial] : [];
      },
      subscribe() {
        return () => {};
      }
    };
    const send = mockSend(async (type, payload) => {
      if (type === 'update-status') {
        expect(payload).toEqual({ id: 'UI-7', status: 'in_progress' });
        // simulate server reconcile payload
        return updated;
      }
      throw new Error('Unexpected');
    });

    const view = createDetailView(mount, send, undefined, stores1);
    await view.load('UI-7');

    const select = /** @type {HTMLSelectElement} */ (
      mount.querySelector('select')
    );
    expect(select.value).toBe('open');

    // Trigger change
    select.value = 'in_progress';
    const beforeDisabled = select.disabled;
    select.dispatchEvent(new Event('change'));
    // After dispatch, the component sets disabled & will re-render upon reply
    expect(beforeDisabled || select.disabled).toBe(true);

    // After async flow, DOM should reflect updated status
    await Promise.resolve(); // allow microtasks
    const select2 = /** @type {HTMLSelectElement} */ (
      mount.querySelector('select')
    );
    expect(select2.value).toBe('in_progress');
  });

  test('reverts and re-enables the status select after a failed update', async () => {
    vi.useFakeTimers();
    document.body.innerHTML =
      '<section class="panel"><div id="mount"></div></section>';
    const mount = /** @type {HTMLElement} */ (document.getElementById('mount'));
    const initial = {
      id: 'UI-8',
      title: 'T',
      description: 'D',
      status: 'open',
      priority: 2
    };
    const stores = {
      /** @param {string} id */
      snapshotFor(id) {
        return id === 'detail:UI-8' ? [initial] : [];
      },
      subscribe() {
        return () => {};
      }
    };
    const send = mockSend(async (type) => {
      if (type === 'update-status') {
        // Same rejection shape the ws transport produces for a bd error.
        throw { code: 'bd_error', message: 'boom' };
      }
      throw new Error('Unexpected');
    });
    const view = createDetailView(mount, send, undefined, stores);
    await view.load('UI-8');
    const select = /** @type {HTMLSelectElement} */ (
      mount.querySelector('select')
    );
    select.value = 'closed';
    select.dispatchEvent(new Event('change'));
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
    // The failure reverts the dropdown and re-enables it (finally doRender)
    const select2 = /** @type {HTMLSelectElement} */ (
      mount.querySelector('select')
    );
    expect(select2.value).toBe('open');
    expect(select2.disabled).toBe(false);
    const toast = /** @type {HTMLElement} */ (
      document.body.querySelector('.toast')
    );
    expect(toast).not.toBeNull();
    expect((toast.textContent || '').toLowerCase()).toContain(
      'failed to update status'
    );
    await vi.advanceTimersByTimeAsync(3000);
    vi.useRealTimers();
  });

  test('shows force-close confirmation on close_blocked, reverts on cancel and retries with force', async () => {
    vi.useFakeTimers();
    document.body.innerHTML =
      '<section class="panel"><div id="mount"></div></section>';
    const mount = /** @type {HTMLElement} */ (document.getElementById('mount'));
    const initial = {
      id: 'UI-10',
      title: 'T',
      description: 'D',
      status: 'open',
      priority: 2
    };
    const stores = {
      /** @param {string} id */
      snapshotFor(id) {
        return id === 'detail:UI-10' ? [initial] : [];
      },
      subscribe() {
        return () => {};
      }
    };
    const send = mockSend(async (type, payload) => {
      if (type === 'update-status') {
        if (/** @type {any} */ (payload).force === true) {
          // The confirmed retry carries the user's explicit consent.
          expect(payload).toEqual({
            id: 'UI-10',
            status: 'closed',
            force: true
          });
          return { ...initial, status: 'closed' };
        }
        // Same rejection shape the ws transport produces for the refusal.
        throw {
          code: 'close_blocked',
          message: 'cannot close UI-10: 1 open child issue(s)'
        };
      }
      throw new Error('Unexpected');
    });
    const view = createDetailView(mount, send, undefined, stores);
    await view.load('UI-10');
    const select = /** @type {HTMLSelectElement} */ (
      mount.querySelector('select')
    );
    select.value = 'closed';
    select.dispatchEvent(new Event('change'));
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
    // The confirmation dialog renders with bd's refusal message
    const dialog = /** @type {HTMLElement} */ (
      document.getElementById('force-close-dialog')
    );
    expect(dialog).not.toBeNull();
    expect(dialog.hasAttribute('open')).toBe(true);
    const message_el = /** @type {HTMLElement} */ (
      dialog.querySelector('.delete-confirm__message')
    );
    expect((message_el.textContent || '').toLowerCase()).toContain(
      '1 open child issue(s)'
    );
    // Cancel keeps the issue open and re-enables the select
    const cancel_btn = /** @type {HTMLElement} */ (
      document.getElementById('force-close-cancel-btn')
    );
    cancel_btn.click();
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
    const select2 = /** @type {HTMLSelectElement} */ (
      mount.querySelector('select')
    );
    expect(select2.value).toBe('open');
    expect(select2.disabled).toBe(false);
    // Cancel closed the confirmation dialog
    expect(dialog.hasAttribute('open')).toBe(false);
    // Retrying and confirming forces the close through
    const select3 = /** @type {HTMLSelectElement} */ (
      mount.querySelector('select')
    );
    select3.value = 'closed';
    select3.dispatchEvent(new Event('change'));
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
    expect(dialog.hasAttribute('open')).toBe(true);
    const confirm_btn = /** @type {HTMLElement} */ (
      document.getElementById('force-close-confirm-btn')
    );
    confirm_btn.click();
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
    const status_calls = /** @type {import('vitest').Mock} */ (
      send
    ).mock.calls.filter((/** @type {any[]} */ c) => c[0] === 'update-status');
    expect(status_calls).toHaveLength(3);
    expect(status_calls[status_calls.length - 1][1]).toEqual({
      id: 'UI-10',
      status: 'closed',
      force: true
    });
    const select4 = /** @type {HTMLSelectElement} */ (
      mount.querySelector('select')
    );
    expect(select4.value).toBe('closed');
    expect(select4.disabled).toBe(false);
    await vi.advanceTimersByTimeAsync(3000);
    vi.useRealTimers();
  });

  test('saves title and re-renders from reply', async () => {
    document.body.innerHTML =
      '<section class="panel"><div id="mount"></div></section>';
    const mount = /** @type {HTMLElement} */ (document.getElementById('mount'));
    const initial = {
      id: 'UI-8',
      title: 'Old',
      description: '',
      status: 'open',
      priority: 1
    };
    const stores2 = {
      /** @param {string} id */
      snapshotFor(id) {
        return id === 'detail:UI-8' ? [initial] : [];
      },
      subscribe() {
        return () => {};
      }
    };
    const send = mockSend(async (type, payload) => {
      if (type === 'edit-text') {
        const next = { ...initial, title: /** @type {any} */ (payload).value };
        return next;
      }
      throw new Error('Unexpected');
    });
    const view = createDetailView(mount, send, undefined, stores2);
    await view.load('UI-8');
    // Enter edit mode by clicking the span
    const titleSpan = /** @type {HTMLSpanElement} */ (
      mount.querySelector('h2 .editable')
    );
    titleSpan.click();
    const titleInput = /** @type {HTMLInputElement} */ (
      mount.querySelector('h2 input')
    );
    const titleSave = /** @type {HTMLButtonElement} */ (
      mount.querySelector('h2 button')
    );
    titleInput.value = 'New Title';
    titleSave.click();
    await Promise.resolve();
    // After save, returns to read mode with updated text
    const titleSpan2 = /** @type {HTMLSpanElement} */ (
      mount.querySelector('h2 .editable')
    );
    expect(titleSpan2.textContent).toBe('New Title');
  });

  test('shows toast on description save error and re-enables', async () => {
    vi.useFakeTimers();
    document.body.innerHTML =
      '<section class="panel"><div id="mount"></div></section>';
    const mount = /** @type {HTMLElement} */ (document.getElementById('mount'));
    const initial = {
      id: 'UI-9',
      title: 'T',
      description: 'D',
      status: 'open',
      priority: 2
    };
    const stores3 = {
      /** @param {string} id */
      snapshotFor(id) {
        return id === 'detail:UI-9' ? [initial] : [];
      },
      subscribe() {
        return () => {};
      }
    };
    const send = mockSend(async (type) => {
      if (type === 'edit-text') {
        throw new Error('boom');
      }
      throw new Error('Unexpected');
    });
    const view = createDetailView(mount, send, undefined, stores3);
    await view.load('UI-9');
    // Enter edit mode
    const md = /** @type {HTMLDivElement} */ (mount.querySelector('.md'));
    md.click();
    const ta = /** @type {HTMLTextAreaElement} */ (
      mount.querySelector('textarea')
    );
    const btn = /** @type {HTMLButtonElement} */ (
      mount.querySelector('.editable-actions button')
    );
    ta.value = 'New D';
    btn.click();
    await Promise.resolve();
    // Toast appears
    const toast = /** @type {HTMLElement} */ (
      document.body.querySelector('.toast')
    );
    expect(toast).not.toBeNull();
    expect((toast.textContent || '').toLowerCase()).toContain(
      'failed to save description'
    );
    // Auto-dismiss after a while
    await vi.advanceTimersByTimeAsync(3000);
    vi.useRealTimers();
  });

  test('reloading an issue returns sections to read mode', async () => {
    document.body.innerHTML =
      '<section class="panel"><div id="mount"></div></section>';
    const mount = /** @type {HTMLElement} */ (document.getElementById('mount'));

    const issue = {
      id: 'UI-9',
      title: 'T',
      description: 'D',
      status: 'open',
      priority: 2
    };
    const stores = {
      /** @param {string} id */
      snapshotFor(id) {
        return id === 'detail:UI-9' ? [issue] : [];
      },
      subscribe() {
        return () => {};
      }
    };
    const view = createDetailView(
      mount,
      mockSend(async () => {
        throw new Error('Unexpected');
      }),
      undefined,
      stores
    );
    await view.load('UI-9');

    // Enter description edit mode
    const md = /** @type {HTMLDivElement} */ (mount.querySelector('.md'));
    md.click();
    expect(
      mount.querySelector('#detail-root .description textarea')
    ).toBeTruthy();

    // Dialog close (main.js calls clear), then reopen calls load again
    view.clear();
    await view.load('UI-9');

    expect(
      mount.querySelector('#detail-root .description textarea')
    ).toBeNull();
    const mdAgain = /** @type {HTMLDivElement} */ (
      mount.querySelector('#detail-root .md')
    );
    expect(mdAgain).toBeTruthy();
    expect(mdAgain.textContent || '').toContain('D');
  });

  test('escape in an editor is default-prevented so the dialog stays open', async () => {
    document.body.innerHTML =
      '<section class="panel"><div id="mount"></div></section>';
    const mount = /** @type {HTMLElement} */ (document.getElementById('mount'));
    /** @type {any} */
    const issue = {
      id: 'UI-9',
      title: 'Title',
      description: 'D',
      status: 'open',
      priority: 2
    };
    const stores = {
      /** @param {string} id */
      snapshotFor(id) {
        return id === 'detail:UI-9' ? [issue] : [];
      },
      subscribe() {
        return () => {};
      }
    };
    const view = createDetailView(
      mount,
      mockSend(async () => issue),
      undefined,
      stores
    );
    await view.load('UI-9');

    // Section editor: Escape must be consumed
    const md = /** @type {HTMLDivElement} */ (mount.querySelector('.md'));
    md.click();
    const ta = /** @type {HTMLTextAreaElement} */ (
      mount.querySelector('#detail-root .description textarea')
    );
    expect(ta).toBeTruthy();
    const ta_ev = new window.KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true
    });
    ta.dispatchEvent(ta_ev);
    expect(ta_ev.defaultPrevented).toBe(true);
    expect(
      mount.querySelector('#detail-root .description textarea')
    ).toBeNull();

    // Title editor: Escape must be consumed
    const span = /** @type {HTMLElement} */ (
      mount.querySelector('.detail-title .editable')
    );
    span.click();
    const input = /** @type {HTMLInputElement} */ (
      mount.querySelector('.detail-title input')
    );
    expect(input).toBeTruthy();
    const in_ev = new window.KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true
    });
    input.dispatchEvent(in_ev);
    expect(in_ev.defaultPrevented).toBe(true);
    expect(mount.querySelector('.detail-title input')).toBeNull();
  });
});
