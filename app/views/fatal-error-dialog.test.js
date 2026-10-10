import { afterEach, describe, expect, test } from 'vitest';
import { createFatalErrorDialog } from './fatal-error-dialog.js';

function mount() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('fatal error dialog', () => {
  test('mounts an alertdialog with reload and dismiss actions', () => {
    const el = mount();
    const dialog = createFatalErrorDialog(el);
    const node = dialog.getElement();
    expect(node.tagName).toBe('DIALOG');
    expect(node.id).toBe('fatal-error-dialog');
    expect(node.getAttribute('role')).toBe('alertdialog');
    expect(node.getAttribute('aria-modal')).toBe('true');
    expect(el.contains(node)).toBe(true);
    expect(node.querySelector('#fatal-error-reload')?.textContent).toBe(
      'Reload'
    );
    expect(node.querySelector('#fatal-error-close')?.textContent).toBe(
      'Dismiss'
    );
  });

  test('open sets title, message, detail and marks the dialog open', () => {
    const dialog = createFatalErrorDialog(mount());
    dialog.open('Command failed', 'bd exited with 1', '  stderr: boom  ');

    const node = dialog.getElement();
    expect(node.querySelector('#fatal-error-title')?.textContent).toBe(
      'Command failed'
    );
    expect(node.querySelector('#fatal-error-message')?.textContent).toBe(
      'bd exited with 1'
    );
    const detail = node.querySelector('#fatal-error-detail');
    expect(detail?.textContent).toBe('stderr: boom');
    expect(detail?.hasAttribute('hidden')).toBe(false);
    expect(node.hasAttribute('open')).toBe(true);
  });

  test('open falls back to default title and message and hides empty detail', () => {
    const dialog = createFatalErrorDialog(mount());
    dialog.open('', '', '   ');

    const node = dialog.getElement();
    expect(node.querySelector('#fatal-error-title')?.textContent).toBe(
      'Unexpected Error'
    );
    expect(node.querySelector('#fatal-error-message')?.textContent).toBe(
      'An unrecoverable error occurred.'
    );
    const detail = node.querySelector('#fatal-error-detail');
    expect(detail?.textContent).toBe('No additional diagnostics available.');
    expect(detail?.hasAttribute('hidden')).toBe(true);

    // Reopening the same instance with detail must clear the hidden state.
    dialog.open('T2', 'M2', 'stderr: boom');
    expect(detail?.hasAttribute('hidden')).toBe(false);
    expect(detail?.textContent).toBe('stderr: boom');
  });

  test('close removes the open attribute', () => {
    const dialog = createFatalErrorDialog(mount());
    dialog.open('T', 'M');
    expect(dialog.getElement().hasAttribute('open')).toBe(true);

    dialog.close();
    expect(dialog.getElement().hasAttribute('open')).toBe(false);
  });

  test('Dismiss button closes the dialog', () => {
    const dialog = createFatalErrorDialog(mount());
    dialog.open('T', 'M');
    const btn = /** @type {HTMLButtonElement} */ (
      dialog.getElement().querySelector('#fatal-error-close')
    );
    btn.click();
    expect(dialog.getElement().hasAttribute('open')).toBe(false);
  });

  test('cancel event (Escape) is prevented and closes the dialog', () => {
    const dialog = createFatalErrorDialog(mount());
    dialog.open('T', 'M');
    const node = dialog.getElement();

    const ev = new Event('cancel', { bubbles: true, cancelable: true });
    node.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(node.hasAttribute('open')).toBe(false);
  });
});
