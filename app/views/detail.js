// Issue Detail view implementation (lit-html based)
import { html, render } from 'lit-html';
import { parseView } from '../router.js';
import { debug } from '../utils/logging.js';
import { updateIssueStatus } from '../utils/status-update.js';
import { showToast } from '../utils/toast.js';
import { createDetailTemplate } from './detail-template.js';

/** @typedef {import('./detail-template.js').IssueDetail} IssueDetail */
/** @typedef {import('./detail-sections.js').Dependency} Dependency */

/**
 * Escape a value for interpolation into raw innerHTML (confirm dialogs).
 * Issue titles and ids come from bd data, which can originate from remotes
 * and other agents, so they must not be injected as markup.
 *
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      /** @type {Record<string, string>} */ ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[c] || c
  );
}

/**
 * Wrap a click-to-edit handler so a click that ends a drag text selection
 * inside the element does not enter edit mode, keeping the text copyable.
 *
 * @param {(ev: Event) => void} onEdit
 * @returns {(ev: MouseEvent) => void}
 */
function editUnlessSelecting(onEdit) {
  return (ev) => {
    const selection = window.getSelection();
    const target = /** @type {Node} */ (ev.currentTarget);
    if (
      selection &&
      !selection.isCollapsed &&
      (target.contains(selection.anchorNode) ||
        target.contains(selection.focusNode))
    ) {
      return;
    }
    onEdit(ev);
  };
}

/**
 * Resize a textarea so its whole content is visible without inner scrolling.
 * `data-min-height` holds the outer height of the read-mode block it replaced,
 * so switching into edit mode never shrinks the section.
 *
 * @param {HTMLTextAreaElement} ta
 */
function fitTextarea(ta) {
  const style = window.getComputedStyle(ta);
  const borders =
    (parseFloat(style.borderTopWidth) || 0) +
    (parseFloat(style.borderBottomWidth) || 0);
  const paddings =
    (parseFloat(style.paddingTop) || 0) +
    (parseFloat(style.paddingBottom) || 0);
  const min_outer = Number(ta.dataset.minHeight) || 0;
  ta.style.height = 'auto';
  const outer = Math.max(ta.scrollHeight + borders, min_outer);
  const inset = style.boxSizing === 'border-box' ? 0 : paddings + borders;
  ta.style.height = `${outer - inset}px`;
}

/**
 * @param {Event} ev
 */
function onEditorInput(ev) {
  fitTextarea(/** @type {HTMLTextAreaElement} */ (ev.currentTarget));
}

/**
 * @param {string} hash
 */
function defaultNavigateFn(hash) {
  window.location.hash = hash;
}

/**
 * Create the Issue Detail view.
 *
 * @param {HTMLElement} mount_element - Element to render into.
 * @param {(type: string, payload?: unknown) => Promise<unknown>} sendFn - RPC transport.
 * @param {(hash: string) => void} [navigateFn] - Navigation function; defaults to setting location.hash.
 * @param {{ snapshotFor?: (client_id: string) => any[], subscribe?: (fn: () => void) => () => void }} [issue_stores] - Optional issue stores for live updates.
 * @returns {{ load: (id: string) => Promise<void>, clear: () => void, destroy: () => void }} View API.
 */
export function createDetailView(
  mount_element,
  sendFn,
  navigateFn = defaultNavigateFn,
  issue_stores = undefined
) {
  const log = debug('views:detail');
  /** @type {IssueDetail | null} */
  let current = null;
  /** @type {string | null} */
  let current_id = null;
  /** @type {boolean} */
  let pending = false;
  /** @type {Record<'title'|'assignee', boolean>} */
  const editing_inline = {
    title: false,
    assignee: false
  };
  /** @type {Record<'description'|'design'|'notes'|'acceptance', boolean>} */
  const editing_text = {
    description: false,
    design: false,
    notes: false,
    acceptance: false
  };
  /** @type {string} */
  let new_label_text = '';
  /** @type {string} */
  let comment_text = '';
  /** @type {boolean} */
  let comment_pending = false;

  /**
   * Apply a mutation reply payload to `current`.
   *
   * Reply payloads are issue objects re-fetched via `bd show`, which reports
   * no `comments` array (only `comment_count`), so previously loaded comments
   * are carried over to keep the section from flashing empty until the next
   * subscription push. Arrays and non-objects are rejected: replacing `current`
   * with a malformed payload blanks the whole view.
   *
   * @param {unknown} updated - Mutation reply payload.
   * @returns {boolean} true when `current` was replaced.
   */
  function applyIssueUpdate(updated) {
    if (!updated || typeof updated !== 'object' || Array.isArray(updated)) {
      return false;
    }
    const prev = current;
    current = /** @type {IssueDetail} */ (updated);
    if (
      prev &&
      /** @type {any} */ (current).comments === undefined &&
      /** @type {any} */ (prev).comments !== undefined
    ) {
      /** @type {any} */ (current).comments = /** @type {any} */ (
        prev
      ).comments;
    }
    return true;
  }
  /**
   * Shared implementation for the destructive-action confirmation dialogs
   * (delete issue, remove dependency/dependent). Each instance owns one
   * lazily created dialog element and renders its content on open.
   *
   * @param {string} id - Dialog element id.
   * @param {string} button_id - Prefix of the cancel/confirm button ids.
   */
  function makeConfirmDialog(id, button_id) {
    /** @type {HTMLDialogElement | null} */
    let dialog = null;

    function ensure() {
      if (dialog) return dialog;
      const el = document.createElement('dialog');
      el.id = id;
      el.setAttribute('role', 'alertdialog');
      el.setAttribute('aria-modal', 'true');
      el.addEventListener('cancel', (ev) => {
        ev.preventDefault();
        closeDialog(el);
      });
      document.body.appendChild(el);
      dialog = el;
      return el;
    }

    /**
     * Render the given content and show the dialog.
     *
     * @param {{ title: string, message: string, confirm_label: string, on_confirm: () => Promise<void> }} spec
     */
    function open(spec) {
      const el = ensure();
      el.innerHTML = `
        <div class="delete-confirm">
          <h2 class="delete-confirm__title">${spec.title}</h2>
          <p class="delete-confirm__message">
            ${spec.message}
          </p>
          <div class="delete-confirm__actions">
            <button type="button" class="btn" id="${button_id}-cancel-btn">Cancel</button>
            <button type="button" class="btn danger" id="${button_id}-confirm-btn">${spec.confirm_label}</button>
          </div>
        </div>
      `;
      el.querySelector(`#${button_id}-cancel-btn`)?.addEventListener(
        'click',
        () => closeDialog(el)
      );
      el.querySelector(`#${button_id}-confirm-btn`)?.addEventListener(
        'click',
        async () => {
          closeDialog(el);
          await spec.on_confirm();
        }
      );
      showModal(el);
    }

    /** Detach the dialog element from the document, if it was created. */
    function destroy() {
      if (dialog && dialog.parentNode) {
        dialog.parentNode.removeChild(dialog);
        dialog = null;
      }
    }

    return { open, destroy };
  }

  const delete_dialog = makeConfirmDialog('delete-confirm-dialog', 'delete');
  const dep_remove_dialog = makeConfirmDialog(
    'dep-remove-confirm-dialog',
    'dep-remove'
  );

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
   * @param {HTMLDialogElement} dialog
   */
  function showModal(dialog) {
    if (typeof dialog.showModal === 'function') {
      try {
        dialog.showModal();
        dialog.setAttribute('open', '');
      } catch {
        dialog.setAttribute('open', '');
      }
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function openDeleteDialog() {
    if (!current) return;
    const issueTitle = current.title || '(no title)';
    delete_dialog.open({
      title: 'Delete Issue',
      message: `Are you sure you want to delete issue <strong>${escapeHtml(current.id)}</strong> — <strong>${escapeHtml(issueTitle)}</strong>? This action cannot be undone.`,
      confirm_label: 'Delete',
      on_confirm: performDelete
    });
  }

  /**
   * @param {string} did - dependency issue id to remove
   * @param {'Dependencies'|'Dependents'} title
   */
  function openDepRemoveDialog(did, title) {
    if (!current) return;
    const direction =
      title === 'Dependencies' ? 'dependency on' : 'dependent from';
    dep_remove_dialog.open({
      title: `Remove ${title.slice(0, -1).replace('ies', 'y')}`,
      message: `Remove ${direction} <strong>${escapeHtml(did)}</strong>?`,
      confirm_label: 'Remove',
      on_confirm: () => performDepRemove(did, title)
    });
  }

  async function performDelete() {
    if (!current) return;
    const id = current.id;
    try {
      await sendFn('delete-issue', { id });
      current = null;
      current_id = null;
      doRender();
      // Navigate back to close the dialog
      const view = parseView(window.location.hash || '');
      navigateFn(`#/${view}`);
    } catch (err) {
      log('delete failed: %o', err);
      showToast('Failed to delete issue', 'error');
    }
  }

  /**
   * @param {Event} ev
   */
  function onDeleteClick(ev) {
    ev.stopPropagation();
    ev.preventDefault();
    openDeleteDialog();
  }

  /**
   * @param {string} message
   */
  function renderPlaceholder(message) {
    render(
      html`
        <div class="panel__body" id="detail-root">
          <p class="muted">${message}</p>
        </div>
      `,
      mount_element
    );
  }

  /**
   * Refresh current from subscription store snapshot if available.
   */
  function refreshFromStore() {
    if (
      !current_id ||
      !issue_stores ||
      typeof issue_stores.snapshotFor !== 'function'
    ) {
      return;
    }
    const arr = /** @type {IssueDetail[]} */ (
      issue_stores.snapshotFor(`detail:${current_id}`)
    );
    if (Array.isArray(arr) && arr.length > 0) {
      // First item is the issue for this subscription
      const found =
        arr.find((it) => String(it.id) === String(current_id)) || arr[0];
      current = /** @type {IssueDetail} */ (found);
    }
  }

  // Live updates: re-render when issue stores change
  if (issue_stores && typeof issue_stores.subscribe === 'function') {
    issue_stores.subscribe(() => {
      try {
        refreshFromStore();
        doRender();
      } catch (err) {
        log('issue stores listener error %o', err);
      }
    });
  }

  // Handlers

  // Labels handlers
  /**
   * @param {Event} ev
   */
  const onLabelInput = (ev) => {
    const el = /** @type {HTMLInputElement} */ (ev.currentTarget);
    new_label_text = el.value || '';
  };
  /**
   * @param {KeyboardEvent} e
   */
  function onLabelKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void onAddLabel();
    }
  }
  async function onAddLabel() {
    if (!current || pending) {
      return;
    }
    const text = new_label_text.trim();
    if (!text) {
      return;
    }
    pending = true;
    try {
      log('add label %s → %s', String(current.id), text);
      const updated = await sendFn('label-add', {
        id: current.id,
        label: text
      });
      if (applyIssueUpdate(updated)) {
        new_label_text = '';
        doRender();
      }
    } catch (err) {
      log('add label failed %s %o', String(current.id), err);
      showToast('Failed to add label', 'error');
    } finally {
      pending = false;
      doRender();
    }
  }
  /**
   * @param {string} label
   */
  async function onRemoveLabel(label) {
    if (!current || pending) {
      return;
    }
    pending = true;
    try {
      log('remove label %s → %s', String(current?.id || ''), label);
      const updated = await sendFn('label-remove', {
        id: current.id,
        label
      });
      if (applyIssueUpdate(updated)) {
        doRender();
      }
    } catch (err) {
      log('remove label failed %s %o', String(current?.id || ''), err);
      showToast('Failed to remove label', 'error');
    } finally {
      pending = false;
      doRender();
    }
  }
  /**
   * @param {Event} ev
   */
  const onStatusChange = async (ev) => {
    if (!current || pending) {
      doRender();
      return;
    }
    const sel = /** @type {HTMLSelectElement} */ (ev.currentTarget);
    const prev = current.status || 'open';
    const next = sel.value;
    if (next === prev) {
      return;
    }
    pending = true;
    current.status = next;
    doRender();
    try {
      log('update status %s → %s', String(current.id), next);
      const updated = await updateIssueStatus(sendFn, {
        id: current.id,
        status: next
      });
      if (applyIssueUpdate(updated)) {
        doRender();
      }
    } catch (err) {
      log('update status failed %s %o', String(current.id), err);
      current.status = prev;
      doRender();
      showToast('Failed to update status', 'error');
    } finally {
      pending = false;
      doRender();
    }
  };
  /**
   * @param {Event} ev
   */
  const onPriorityChange = async (ev) => {
    if (!current || pending) {
      doRender();
      return;
    }
    const sel = /** @type {HTMLSelectElement} */ (ev.currentTarget);
    const prev = typeof current.priority === 'number' ? current.priority : 2;
    const next = Number(sel.value);
    if (next === prev) {
      return;
    }
    pending = true;
    current.priority = next;
    doRender();
    try {
      log('update priority %s → %d', String(current.id), next);
      const updated = await sendFn('update-priority', {
        id: current.id,
        priority: next
      });
      if (applyIssueUpdate(updated)) {
        doRender();
      }
    } catch (err) {
      log('update priority failed %s %o', String(current.id), err);
      current.priority = prev;
      doRender();
      showToast('Failed to update priority', 'error');
    } finally {
      pending = false;
      doRender();
    }
  };

  /**
   * Build the inline edit handlers for one long-text section (description,
   * design, notes, acceptance).
   *
   * @param {'description'|'design'|'notes'|'acceptance'} field - Issue field and template section class.
   * @param {{ focus_on_edit?: boolean }} [options]
   */
  function makeTextSectionHandlers(field, options = {}) {
    /**
     * @param {Event} ev
     */
    const onEdit = (ev) => {
      enterTextEdit(ev, field, () => {
        editing_text[field] = true;
      });
      if (options.focus_on_edit) {
        try {
          const ta = /** @type {HTMLTextAreaElement|null} */ (
            mount_element.querySelector(`#detail-root .${field} textarea`)
          );
          if (ta) {
            ta.focus();
          }
        } catch (err) {
          log('focus %s textarea failed %o', field, err);
        }
      }
    };
    /**
     * @param {KeyboardEvent} ev
     */
    const onKeydown = (ev) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        editing_text[field] = false;
        doRender();
      } else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
        const btn = /** @type {HTMLButtonElement|null} */ (
          mount_element.querySelector(
            `#detail-root .${field} .editable-actions button`
          )
        );
        if (btn) {
          btn.click();
        }
      }
    };
    const onSave = async () => {
      if (!current || pending) {
        return;
      }
      const ta = /** @type {HTMLTextAreaElement|null} */ (
        mount_element.querySelector(`#detail-root .${field} textarea`)
      );
      const prev = String(current[field] || '');
      const next = ta ? ta.value : '';
      if (next === prev) {
        editing_text[field] = false;
        doRender();
        return;
      }
      pending = true;
      if (ta) {
        ta.disabled = true;
      }
      try {
        log('save %s %s', field, String(current?.id || ''));
        const updated = await sendFn('edit-text', {
          id: current.id,
          field,
          value: next
        });
        if (applyIssueUpdate(updated)) {
          editing_text[field] = false;
          doRender();
        }
      } catch (err) {
        log('save %s failed %s %o', field, String(current?.id || ''), err);
        current[field] = prev;
        editing_text[field] = false;
        doRender();
        showToast(`Failed to save ${field}`, 'error');
      } finally {
        pending = false;
        doRender();
      }
    };
    const onCancel = () => {
      editing_text[field] = false;
      doRender();
    };
    return { onEdit, onKeydown, onSave, onCancel };
  }

  const {
    onEdit: onDescEdit,
    onKeydown: onDescKeydown,
    onSave: onDescSave,
    onCancel: onDescCancel
  } = makeTextSectionHandlers('description');
  const {
    onEdit: onDesignEdit,
    onKeydown: onDesignKeydown,
    onSave: onDesignSave,
    onCancel: onDesignCancel
  } = makeTextSectionHandlers('design', { focus_on_edit: true });
  const {
    onEdit: onNotesEdit,
    onKeydown: onNotesKeydown,
    onSave: onNotesSave,
    onCancel: onNotesCancel
  } = makeTextSectionHandlers('notes');
  const {
    onEdit: onAcceptEdit,
    onKeydown: onAcceptKeydown,
    onSave: onAcceptSave,
    onCancel: onAcceptCancel
  } = makeTextSectionHandlers('acceptance');

  /**
   * Build the inline edit handlers for one single-line issue field (title,
   * assignee): the read-mode span starts editing, the input saves or cancels.
   *
   * @param {'title'|'assignee'} field - Issue field and editing_inline key.
   * @param {{ input_selector: string, send: (id: string, value: string) => Promise<unknown>, toast_message: string }} spec
   */
  function makeInlineFieldHandlers(field, spec) {
    /**
     * @param {boolean} on
     */
    const set_editing = (on) => {
      editing_inline[field] = on;
      doRender();
    };

    const onSpanClick = () => set_editing(true);

    /**
     * @param {KeyboardEvent} ev
     */
    const onKeydown = (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        set_editing(true);
      }
    };

    const onCancel = () => set_editing(false);

    const onSave = async () => {
      if (!current || pending) {
        return;
      }
      const input = /** @type {HTMLInputElement|null} */ (
        mount_element.querySelector(spec.input_selector)
      );
      const prev = String(current[field] ?? '');
      const next = input ? input.value : '';
      if (next === prev) {
        set_editing(false);
        return;
      }
      pending = true;
      if (input) {
        input.disabled = true;
      }
      try {
        log('save %s %s → %s', field, String(current.id), next);
        const updated = await spec.send(current.id, next);
        if (applyIssueUpdate(updated)) {
          set_editing(false);
        }
      } catch (err) {
        log('save %s failed %s %o', field, String(current.id), err);
        current[field] = prev;
        set_editing(false);
        showToast(spec.toast_message, 'error');
      } finally {
        pending = false;
        doRender();
      }
    };

    return { onSpanClick, onKeydown, onSave, onCancel };
  }

  const {
    onSpanClick: onTitleSpanClick,
    onKeydown: onTitleKeydown,
    onSave: onTitleSave,
    onCancel: onTitleCancel
  } = makeInlineFieldHandlers('title', {
    input_selector: 'h2 input',
    send: (id, value) => sendFn('edit-text', { id, field: 'title', value }),
    toast_message: 'Failed to save title'
  });
  const {
    onSpanClick: onAssigneeSpanClick,
    onKeydown: onAssigneeKeydown,
    onSave: onAssigneeSave,
    onCancel: onAssigneeCancel
  } = makeInlineFieldHandlers('assignee', {
    input_selector: '#detail-root .prop.assignee input',
    send: (id, value) => sendFn('update-assignee', { id, assignee: value }),
    toast_message: 'Failed to update assignee'
  });

  // Comment input handlers
  /**
   * @param {Event} ev
   */
  const onCommentInput = (ev) => {
    const el = /** @type {HTMLTextAreaElement} */ (ev.currentTarget);
    const prev_has_text = comment_text.trim().length > 0;
    comment_text = el.value || '';
    const has_text = comment_text.trim().length > 0;
    // Re-render when the "has content" state changes to update button disabled state
    if (prev_has_text !== has_text) {
      doRender();
    }
  };

  const onCommentSubmit = async () => {
    if (!current || comment_pending || !comment_text.trim()) {
      return;
    }
    comment_pending = true;
    doRender();
    try {
      log('add comment to %s', String(current.id));
      const result = await sendFn('add-comment', {
        id: current.id,
        text: comment_text.trim()
      });
      if (Array.isArray(result)) {
        // Update comments in current issue
        /** @type {any} */ (current).comments = result;
        comment_text = '';
        doRender();
      }
    } catch (err) {
      log('add comment failed %s %o', String(current.id), err);
      showToast('Failed to add comment', 'error');
    } finally {
      comment_pending = false;
      doRender();
    }
  };

  /**
   * @param {KeyboardEvent} ev
   */
  const onCommentKeydown = (ev) => {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      onCommentSubmit();
    }
  };

  const detail_template = createDetailTemplate({
    navigateFn,
    makeDepAddClick,
    makeDepRemoveClick,
    editUnlessSelecting,
    onEditorInput,
    onTitleInputKeydown,
    onTitleSpanClick,
    onTitleKeydown,
    onTitleSave,
    onTitleCancel,
    onStatusChange,
    onPriorityChange,
    onDescKeydown,
    onDescEdit,
    onDescSave,
    onDescCancel,
    onDescEditableKeydown,
    onDesignKeydown,
    onDesignEdit,
    onDesignSave,
    onDesignCancel,
    onDesignEditableKeydown,
    onNotesKeydown,
    onNotesEdit,
    onNotesSave,
    onNotesCancel,
    onNotesEditableKeydown,
    onAcceptKeydown,
    onAcceptEdit,
    onAcceptSave,
    onAcceptCancel,
    onAcceptEditableKeydown,
    onRemoveLabel,
    onLabelInput,
    onLabelKeydown,
    onAddLabel,
    onCommentInput,
    onCommentKeydown,
    onCommentSubmit,
    onDeleteClick,
    onAssigneeSpanClick,
    onAssigneeKeydown,
    onAssigneeSave,
    onAssigneeCancel
  });

  /**
   * Switch a markdown section into edit mode and fit its textarea to the
   * content, keeping at least the height of the read-mode block.
   *
   * @param {Event} ev - Event fired on the read-mode block.
   * @param {string} section - Class of the edit-mode wrapper (e.g. 'notes').
   * @param {() => void} enable - Sets the section's edit flag.
   */
  function enterTextEdit(ev, section, enable) {
    const read_height = /** @type {HTMLElement} */ (ev.currentTarget)
      .offsetHeight;
    enable();
    doRender();
    const ta = /** @type {HTMLTextAreaElement|null} */ (
      mount_element.querySelector(`#detail-root .${section} textarea`)
    );
    if (ta) {
      ta.dataset.minHeight = String(read_height);
      fitTextarea(ta);
    }
  }

  function doRender() {
    if (!current) {
      renderPlaceholder(current_id ? 'Loading…' : 'No issue selected');
      return;
    }
    render(
      detail_template(current, {
        edit_title: editing_inline.title,
        editing_text,
        pending,
        edit_assignee: editing_inline.assignee,
        new_label_text,
        comment_text,
        comment_pending
      }),
      mount_element
    );
  }

  /**
   * @param {string} did
   * @param {'Dependencies'|'Dependents'} title
   */
  async function performDepRemove(did, title) {
    if (!current || pending) return;
    pending = true;
    try {
      if (title === 'Dependencies') {
        const updated = await sendFn('dep-remove', {
          a: current.id,
          b: did,
          view_id: current.id
        });
        if (applyIssueUpdate(updated)) {
          doRender();
        }
      } else {
        const updated = await sendFn('dep-remove', {
          a: did,
          b: current.id,
          view_id: current.id
        });
        if (applyIssueUpdate(updated)) {
          doRender();
        }
      }
    } catch (err) {
      log('dep-remove failed %o', err);
    } finally {
      pending = false;
      doRender();
    }
  }

  /**
   * Create a click handler for the remove button of a dependency row.
   *
   * @param {string} did
   * @param {'Dependencies'|'Dependents'} title
   * @returns {(ev: Event) => void}
   */
  function makeDepRemoveClick(did, title) {
    return (ev) => {
      ev.stopPropagation();
      if (!current || pending) {
        return;
      }
      openDepRemoveDialog(did, title);
    };
  }

  /**
   * Create a click handler for the Add button in a dependency section.
   *
   * @param {Dependency[]} items
   * @param {'Dependencies'|'Dependents'} title
   * @returns {(ev: Event) => Promise<void>}
   */
  function makeDepAddClick(items, title) {
    return async (ev) => {
      if (!current || pending) {
        return;
      }
      const btn = /** @type {HTMLButtonElement} */ (ev.currentTarget);
      const input = /** @type {HTMLInputElement|null} */ (
        btn.previousElementSibling
      );
      const target = input ? input.value.trim() : '';
      if (!target || target === current.id) {
        showToast('Enter a different issue id');
        return;
      }
      const set = new Set((items || []).map((d) => d.id));
      if (set.has(target)) {
        showToast('Link already exists');
        return;
      }
      pending = true;
      if (btn) {
        btn.disabled = true;
      }
      if (input) {
        input.disabled = true;
      }
      try {
        if (title === 'Dependencies') {
          const updated = await sendFn('dep-add', {
            a: current.id,
            b: target,
            view_id: current.id
          });
          if (applyIssueUpdate(updated)) {
            doRender();
          }
        } else {
          const updated = await sendFn('dep-add', {
            a: target,
            b: current.id,
            view_id: current.id
          });
          if (applyIssueUpdate(updated)) {
            doRender();
          }
        }
      } catch (err) {
        log('dep-add failed %o', err);
        showToast('Failed to add dependency', 'error');
      } finally {
        pending = false;
      }
    };
  }
  /**
   * @param {KeyboardEvent} ev
   */
  function onTitleInputKeydown(ev) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      editing_inline.title = false;
      doRender();
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      onTitleSave();
    }
  }

  /**
   * @param {KeyboardEvent} ev
   */
  function onDescEditableKeydown(ev) {
    if (ev.key === 'Enter') {
      onDescEdit(ev);
    }
  }

  /**
   * @param {KeyboardEvent} ev
   */
  function onAcceptEditableKeydown(ev) {
    if (ev.key === 'Enter') {
      onAcceptEdit(ev);
    }
  }

  /**
   * @param {KeyboardEvent} ev
   */
  function onNotesEditableKeydown(ev) {
    if (ev.key === 'Enter') {
      onNotesEdit(ev);
    }
  }

  /**
   * @param {KeyboardEvent} ev
   */
  function onDesignEditableKeydown(ev) {
    if (ev.key === 'Enter') {
      onDesignEdit(ev);
    }
  }

  return {
    async load(id) {
      if (!id) {
        renderPlaceholder('No issue selected');
        return;
      }
      current_id = String(id);
      // Try from store first; show placeholder while waiting for snapshot
      current = null;
      refreshFromStore();
      if (!current) {
        renderPlaceholder('Loading…');
      }
      // Render from current (if available) or keep placeholder until push arrives
      pending = false;
      editing_inline.title = false;
      editing_text.description = false;
      editing_text.design = false;
      editing_text.notes = false;
      editing_text.acceptance = false;
      editing_inline.assignee = false;
      new_label_text = '';
      comment_text = '';
      comment_pending = false;
      doRender();

      // Fetch comments if not already present
      if (current && !(/** @type {any} */ (current).comments)) {
        try {
          const comments = await sendFn('get-comments', { id: current_id });
          if (Array.isArray(comments) && current && current_id === id) {
            /** @type {any} */ (current).comments = comments;
            doRender();
          }
        } catch (err) {
          log('fetch comments failed %s %o', id, err);
        }
      }
    },
    clear() {
      renderPlaceholder('Select an issue to view details');
    },
    destroy() {
      mount_element.replaceChildren();
      delete_dialog.destroy();
      dep_remove_dialog.destroy();
    }
  };
}
