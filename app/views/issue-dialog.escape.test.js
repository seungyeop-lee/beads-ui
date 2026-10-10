import { describe, expect, test, vi } from 'vitest';
import { createIssueDialog } from './issue-dialog.js';

// Provide a minimal dialog polyfill for jsdom environments
if (typeof HTMLDialogElement !== 'undefined') {
  const proto = /** @type {any} */ (HTMLDialogElement.prototype);
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function showModal() {
      this.setAttribute('open', '');
    };
    proto.close = function close() {
      this.removeAttribute('open');
    };
  }
}

describe('issue-dialog escape handling', () => {
  test('escape inside an editor cancels the edit, not the dialog', () => {
    document.body.innerHTML = '<div id="mount"></div>';
    const mount = /** @type {HTMLElement} */ (document.getElementById('mount'));
    const on_close = vi.fn();
    const store = { getState: () => ({ selected_id: null }) };
    const dlg = createIssueDialog(mount, /** @type {any} */ (store), on_close);
    dlg.open('UI-1');
    const dialog = /** @type {HTMLDialogElement} */ (
      document.getElementById('issue-dialog')
    );
    dlg.getMount().innerHTML = '<textarea id="inner-editor"></textarea>';
    const editor = /** @type {HTMLTextAreaElement} */ (
      document.getElementById('inner-editor')
    );
    editor.focus();
    editor.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    dialog.dispatchEvent(new window.Event('cancel', { cancelable: true }));
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(on_close).not.toHaveBeenCalled();

    // A later escape outside editors still closes the dialog
    dialog.dispatchEvent(new window.Event('cancel', { cancelable: true }));
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(on_close).toHaveBeenCalledTimes(1);
  });

  test('escape outside editors closes the dialog', () => {
    document.body.innerHTML = '<div id="mount"></div>';
    const mount = /** @type {HTMLElement} */ (document.getElementById('mount'));
    const on_close = vi.fn();
    const store = { getState: () => ({ selected_id: null }) };
    const dlg = createIssueDialog(mount, /** @type {any} */ (store), on_close);
    dlg.open('UI-2');
    const dialog = /** @type {HTMLDialogElement} */ (
      document.getElementById('issue-dialog')
    );
    dialog.dispatchEvent(new window.Event('cancel', { cancelable: true }));
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(on_close).toHaveBeenCalledTimes(1);
  });
});
