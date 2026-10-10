import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ISSUE_TYPES, typeLabel } from '../utils/issue-type.js';
import { priority_levels } from '../utils/priority.js';
import { createNewIssueDialog } from './new-issue-dialog.js';

/**
 * @param {(type: string, payload?: unknown) => Promise<any>} impl
 */
const mockSend = (impl) => vi.fn(impl);

/** @returns {HTMLElement} */
function mountDiv() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return div;
}

describe('views/new-issue-dialog', () => {
  /** @type {HTMLElement} */
  let mount;
  /** @type {ReturnType<typeof mountDiv>} */
  let root;

  beforeEach(() => {
    window.localStorage.clear();
    mount = mountDiv();
    root = mount;
  });

  afterEach(() => {
    root.remove();
  });

  test('builds dialog with populated form controls', () => {
    const send = mockSend(async () => null);
    const gotoIssue = vi.fn();
    const dialog_obj = createNewIssueDialog(mount, send, { gotoIssue });
    const dialog = /** @type {HTMLDialogElement} */ (
      document.getElementById('new-issue-dialog')
    );
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');

    const type = /** @type {HTMLSelectElement} */ (
      dialog?.querySelector('#new-type')
    );
    const type_texts = Array.from(type?.options || []).map(
      (o) => o.textContent
    );
    expect(type_texts[0]).toBe('— Select —');
    expect(type_texts.slice(1)).toEqual(ISSUE_TYPES.map((t) => typeLabel(t)));

    const prio = /** @type {HTMLSelectElement} */ (
      dialog?.querySelector('#new-priority')
    );
    const prio_texts = Array.from(prio?.options || []).map(
      (o) => o.textContent
    );
    expect(prio_texts).toEqual(priority_levels.map((p, i) => `${i} – ${p}`));

    const title = /** @type {HTMLInputElement} */ (
      dialog?.querySelector('#new-title')
    );
    expect(title?.required).toBe(true);
    void dialog_obj;
  });

  test('open() shows the dialog, resets the form, and focuses title', async () => {
    const send = mockSend(async () => null);
    const dlg = createNewIssueDialog(mount, send, { gotoIssue: vi.fn() });
    const dialog = /** @type {HTMLDialogElement} */ (
      document.getElementById('new-issue-dialog')
    );
    const title = /** @type {HTMLInputElement} */ (
      dialog?.querySelector('#new-title')
    );
    title.value = 'leftover';
    dlg.close();
    dlg.open();
    expect(dialog?.hasAttribute('open')).toBe(true);
    expect(title.value).toBe('');
    await new Promise((r) => setTimeout(r, 10));
    expect(document.activeElement).toBe(title);
  });

  test('open() restores type and priority from saved defaults', () => {
    const send = mockSend(async () => null);
    window.localStorage.setItem('beads-ui.new.type', ISSUE_TYPES[0]);
    window.localStorage.setItem('beads-ui.new.priority', '3');
    const dlg = createNewIssueDialog(mount, send, { gotoIssue: vi.fn() });
    const dialog = /** @type {HTMLDialogElement} */ (
      document.getElementById('new-issue-dialog')
    );
    dlg.open();
    const type = /** @type {HTMLSelectElement} */ (
      dialog?.querySelector('#new-type')
    );
    const prio = /** @type {HTMLSelectElement} */ (
      dialog?.querySelector('#new-priority')
    );
    expect(type.value).toBe(ISSUE_TYPES[0]);
    expect(prio.value).toBe('3');
  });

  test('submit with empty title shows error and sends nothing', async () => {
    const send = mockSend(async () => null);
    const dlg = createNewIssueDialog(mount, send, { gotoIssue: vi.fn() });
    const dialog = /** @type {HTMLDialogElement} */ (
      document.getElementById('new-issue-dialog')
    );
    dlg.open();
    dialog
      ?.querySelector('#new-issue-form')
      ?.dispatchEvent(new Event('submit'));
    await new Promise((r) => setTimeout(r, 10));
    const error = /** @type {HTMLElement} */ (
      dialog?.querySelector('#new-issue-error')
    );
    expect(error?.textContent).toBe('Title is required');
    expect(send).not.toHaveBeenCalled();
    expect(dialog?.hasAttribute('open')).toBe(true);
  });

  test('submit creates the issue, applies labels, and navigates to it', async () => {
    const send = mockSend(async (type) => {
      if (type === 'create-issue') return { id: 'UI-123' };
      if (type === 'list-issues') {
        return [
          { id: 'UI-9', title: 'Fix thing' },
          { id: 'UI-123', title: 'Fix thing' },
          { id: 'UI-5', title: 'Unrelated' }
        ];
      }
      return null;
    });
    const gotoIssue = vi.fn();
    const setState = vi.fn();
    const dlg = createNewIssueDialog(
      mount,
      send,
      { gotoIssue },
      {
        setState,
        getState: () => ({})
      }
    );
    const dialog = /** @type {HTMLDialogElement} */ (
      document.getElementById('new-issue-dialog')
    );
    dlg.open();
    const form = /** @type {HTMLFormElement} */ (
      dialog?.querySelector('#new-issue-form')
    );
    const title = /** @type {HTMLInputElement} */ (
      document.getElementById('new-title')
    );
    title.value = 'Fix thing';
    const labels_input = /** @type {HTMLInputElement} */ (
      document.getElementById('new-labels')
    );
    labels_input.value = 'bug ,  ui ';
    form.dispatchEvent(new Event('submit'));
    await new Promise((r) => setTimeout(r, 20));

    expect(send).toHaveBeenCalledWith('create-issue', {
      title: 'Fix thing',
      priority: 2
    });
    expect(send).toHaveBeenCalledWith('list-issues', {
      filters: { status: 'open', limit: 50 }
    });
    expect(send).toHaveBeenCalledWith('label-add', {
      id: 'UI-123',
      label: 'bug'
    });
    expect(send).toHaveBeenCalledWith('label-add', {
      id: 'UI-123',
      label: 'ui'
    });
    expect(gotoIssue).toHaveBeenCalledWith('UI-123');
    expect(setState).toHaveBeenCalledWith({ selected_id: 'UI-123' });
    expect(dialog?.hasAttribute('open')).toBe(false);
  });

  test('create failure shows error and keeps the dialog usable', async () => {
    const send = mockSend(async (type) => {
      if (type === 'create-issue') throw new Error('boom');
      return null;
    });
    const dlg = createNewIssueDialog(mount, send, { gotoIssue: vi.fn() });
    const dialog = /** @type {HTMLDialogElement} */ (
      document.getElementById('new-issue-dialog')
    );
    dlg.open();
    const title = /** @type {HTMLInputElement} */ (
      document.getElementById('new-title')
    );
    title.value = 'Will fail';
    dialog
      ?.querySelector('#new-issue-form')
      ?.dispatchEvent(new Event('submit'));
    await new Promise((r) => setTimeout(r, 20));

    const error = /** @type {HTMLElement} */ (
      dialog?.querySelector('#new-issue-error')
    );
    const create_btn = /** @type {HTMLButtonElement} */ (
      dialog?.querySelector('#btn-create')
    );
    const title_after = /** @type {HTMLInputElement} */ (
      document.getElementById('new-title')
    );
    expect(error?.textContent).toBe('Failed to create issue');
    expect(dialog?.hasAttribute('open')).toBe(true);
    expect(create_btn.textContent).toBe('Create');
    expect(create_btn.disabled).toBe(false);
    expect(title_after.disabled).toBe(false);
  });

  test('cancel button, close button, and Esc cancel event close the dialog', () => {
    const send = mockSend(async () => null);
    const dlg = createNewIssueDialog(mount, send, { gotoIssue: vi.fn() });
    const dialog = /** @type {HTMLDialogElement} */ (
      document.getElementById('new-issue-dialog')
    );
    dlg.open();
    /** @type {HTMLButtonElement} */ (
      dialog?.querySelector('#btn-cancel')
    )?.click();
    expect(dialog?.hasAttribute('open')).toBe(false);

    dlg.open();
    /** @type {HTMLButtonElement} */ (
      dialog?.querySelector('.new-issue__close')
    )?.click();
    expect(dialog?.hasAttribute('open')).toBe(false);

    dlg.open();
    dialog?.dispatchEvent(new window.Event('cancel', { cancelable: true }));
    expect(dialog?.hasAttribute('open')).toBe(false);
  });

  test('Ctrl+Enter submits the form', async () => {
    const send = mockSend(async (type) => {
      if (type === 'create-issue') return { id: 'UI-7' };
      if (type === 'list-issues') return [{ id: 'UI-7', title: 'Kb' }];
      return null;
    });
    const dlg = createNewIssueDialog(mount, send, { gotoIssue: vi.fn() });
    const dialog = /** @type {HTMLDialogElement} */ (
      document.getElementById('new-issue-dialog')
    );
    dlg.open();
    const title = /** @type {HTMLInputElement} */ (
      document.getElementById('new-title')
    );
    title.value = 'Kb';
    dialog?.dispatchEvent(
      new window.KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true,
        cancelable: true
      })
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(send).toHaveBeenCalledWith('create-issue', {
      title: 'Kb',
      priority: 2
    });
  });

  test('successful create saves type and priority defaults', async () => {
    const send = mockSend(async (type) => {
      if (type === 'create-issue') return { id: 'UI-31' };
      if (type === 'list-issues') return [{ id: 'UI-31', title: 'D' }];
      return null;
    });
    const dlg = createNewIssueDialog(mount, send, { gotoIssue: vi.fn() });
    const dialog = /** @type {HTMLDialogElement} */ (
      document.getElementById('new-issue-dialog')
    );
    dlg.open();
    const title = /** @type {HTMLInputElement} */ (
      document.getElementById('new-title')
    );
    title.value = 'D';
    const type = /** @type {HTMLSelectElement} */ (
      dialog?.querySelector('#new-type')
    );
    const prio = /** @type {HTMLSelectElement} */ (
      dialog?.querySelector('#new-priority')
    );
    type.value = /** @type {string} */ (ISSUE_TYPES[0]);
    prio.value = '4';
    dialog
      ?.querySelector('#new-issue-form')
      ?.dispatchEvent(new Event('submit'));
    await new Promise((r) => setTimeout(r, 20));

    expect(window.localStorage.getItem('beads-ui.new.type')).toBe(
      ISSUE_TYPES[0]
    );
    expect(window.localStorage.getItem('beads-ui.new.priority')).toBe('4');
  });
});
