/**
 * Shared `update-status` flow with bd close-policy confirmation.
 *
 * bd 1.2.1+ refuses `bd update --status closed` while the issue has open
 * children or a live blocker; the server surfaces that refusal as a
 * `close_blocked` error. Before giving up, ask the user whether to force
 * the close (bd's own escape hatch, `--force`) and retry once.
 */

/**
 * @import { MessageType } from '../protocol.js'
 */

/**
 * @typedef {(type: MessageType, payload?: unknown) => Promise<unknown>} SendFn
 */
/** @type {HTMLDialogElement | null} */
let dialog_el = null;

/**
 * Ensure the shared force-close confirmation dialog exists in the document.
 *
 * @returns {HTMLDialogElement}
 */
function ensureDialog() {
  if (dialog_el && dialog_el.isConnected) {
    return dialog_el;
  }
  dialog_el = document.createElement('dialog');
  dialog_el.id = 'force-close-dialog';
  dialog_el.setAttribute('role', 'alertdialog');
  dialog_el.setAttribute('aria-modal', 'true');
  document.body.appendChild(dialog_el);
  return dialog_el;
}

/**
 * @param {HTMLDialogElement} dialog
 */
function closeDialog(dialog) {
  if (typeof dialog.close === 'function') {
    dialog.close();
  }
  dialog.removeAttribute('open');
}

/**
 * Show the force-close confirmation. Resolves true when the user chooses to
 * force the close, false on cancel or dismiss.
 *
 * @param {string} message - bd's refusal message shown as the reason.
 * @returns {Promise<boolean>}
 */
function confirmForceClose(message) {
  return new Promise((resolve) => {
    const el = ensureDialog();
    /** @type {boolean} */
    let settled = false;
    /** @param {boolean} value */
    const settle = (value) => {
      if (settled) return;
      settled = true;
      closeDialog(el);
      resolve(value);
    };
    el.innerHTML = `
      <div class="delete-confirm">
        <h2 class="delete-confirm__title">Close anyway?</h2>
        <p class="delete-confirm__message"></p>
        <div class="delete-confirm__actions">
          <button type="button" class="btn" id="force-close-cancel-btn">Cancel</button>
          <button type="button" class="btn danger" id="force-close-confirm-btn">Force close</button>
        </div>
      </div>
    `;
    /** @type {HTMLElement | null} */
    const message_el = el.querySelector('.delete-confirm__message');
    if (message_el) {
      message_el.textContent = message;
    }
    el.querySelector('#force-close-cancel-btn')?.addEventListener('click', () =>
      settle(false)
    );
    el.querySelector('#force-close-confirm-btn')?.addEventListener(
      'click',
      () => settle(true)
    );
    el.addEventListener(
      'cancel',
      (ev) => {
        ev.preventDefault();
        settle(false);
      },
      { once: true }
    );
    if (typeof el.showModal === 'function') {
      try {
        el.showModal();
        el.setAttribute('open', '');
      } catch {
        el.setAttribute('open', '');
      }
    } else {
      el.setAttribute('open', '');
    }
  });
}

/**
 * Send `update-status`, offering a force-close confirmation when bd's close
 * policy refuses the transition to `closed`.
 *
 * @param {SendFn} send
 * @param {{ id: string, status: string }} payload - `status` is one of
 * `open` / `in_progress` / `closed`; the server re-validates.
 * @param {(message: string) => Promise<boolean>} [confirm] - Confirmation
 * gate; defaults to the modal dialog. Resolves true to retry with force.
 * @returns {Promise<any>} Resolves with the reply payload; rejects with the
 * original error when the user declines the force close or the retry fails.
 */
export async function updateIssueStatus(
  send,
  payload,
  confirm = confirmForceClose
) {
  try {
    return await send('update-status', payload);
  } catch (err) {
    const refusal = /** @type {{ code?: string, message?: string }} */ (err);
    if (!refusal || refusal.code !== 'close_blocked') {
      throw err;
    }
    const force = await confirm(
      refusal.message || 'bd refused to close this issue.'
    );
    if (!force) {
      throw err;
    }
    return await send('update-status', { ...payload, force: true });
  }
}
