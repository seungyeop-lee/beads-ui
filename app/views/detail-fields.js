// Detail field templates: title, status, priority, and assignee blocks.
// Bound to the detail view's event handlers.
import { html } from 'lit-html';
import { emojiForPriority } from '../utils/priority-badge.js';
import { priority_levels } from '../utils/priority.js';
import { statusLabel } from '../utils/status.js';

/**
 * @typedef {import('./detail-template.js').IssueDetail} IssueDetail
 */

/**
 * @typedef {import('./detail-template.js').DetailUiState} DetailUiState
 */

/**
 * Create the detail field templates bound to the view's event handlers.
 *
 * @param {Record<string, (...args: any[]) => any>} handlers - Detail view
 * event handlers, keyed by their names in detail.js.
 * @returns {{
 *   titleZone: (issue: IssueDetail, ui: DetailUiState) => import('lit-html').TemplateResult<1>,
 *   statusSelect: (issue: IssueDetail, ui: DetailUiState) => import('lit-html').TemplateResult<1>,
 *   prioritySelect: (issue: IssueDetail, ui: DetailUiState) => import('lit-html').TemplateResult<1>,
 *   assigneeValue: (issue: IssueDetail, ui: DetailUiState) => import('lit-html').TemplateResult<1>
 * }}
 */
export function createDetailFields(handlers) {
  const {
    onTitleInputKeydown,
    onTitleSpanClick,
    onTitleKeydown,
    onTitleSave,
    onTitleCancel,
    onStatusChange,
    onPriorityChange,
    onAssigneeSpanClick,
    onAssigneeKeydown,
    onAssigneeSave,
    onAssigneeCancel
  } = handlers;

  /**
   * @param {IssueDetail} issue
   * @param {DetailUiState} ui
   */
  function titleZone(issue, ui) {
    return ui.edit_title
      ? html`<div class="detail-title">
          <h2>
            <input
              type="text"
              aria-label="Edit title"
              .value=${issue.title || ''}
              @keydown=${onTitleInputKeydown}
            />
            <button @click=${onTitleSave}>Save</button>
            <button @click=${onTitleCancel}>Cancel</button>
          </h2>
        </div>`
      : html`<div class="detail-title">
          <h2>
            <span
              class="editable"
              tabindex="0"
              role="button"
              aria-label="Edit title"
              @click=${onTitleSpanClick}
              @keydown=${onTitleKeydown}
              >${issue.title || ''}</span
            >
          </h2>
        </div>`;
  }

  /**
   * @param {IssueDetail} issue
   * @param {DetailUiState} ui
   */
  function statusSelect(issue, ui) {
    return html`<select
      class=${`badge-select badge--status is-${issue.status || 'open'}`}
      @change=${onStatusChange}
      .value=${issue.status || 'open'}
      ?disabled=${ui.pending}
    >
      ${(() => {
        const cur = String(issue.status || 'open');
        return ['open', 'in_progress', 'closed'].map(
          (s) =>
            html`<option value=${s} ?selected=${cur === s}>
              ${statusLabel(s)}
            </option>`
        );
      })()}
    </select>`;
  }

  /**
   * @param {IssueDetail} issue
   * @param {DetailUiState} ui
   */
  function prioritySelect(issue, ui) {
    return html`<select
      class=${`badge-select badge--priority is-p${String(
        typeof issue.priority === 'number' ? issue.priority : 2
      )}`}
      @change=${onPriorityChange}
      .value=${String(typeof issue.priority === 'number' ? issue.priority : 2)}
      ?disabled=${ui.pending}
    >
      ${(() => {
        const cur = String(
          typeof issue.priority === 'number' ? issue.priority : 2
        );
        return priority_levels.map(
          (p, i) =>
            html`<option value=${String(i)} ?selected=${cur === String(i)}>
              ${emojiForPriority(i)} ${p}
            </option>`
        );
      })()}
    </select>`;
  }

  /**
   * @param {IssueDetail} issue
   * @param {DetailUiState} ui
   */
  function assigneeValue(issue, ui) {
    return html`${ui.edit_assignee
      ? html`<input
            type="text"
            aria-label="Edit assignee"
            .value=${/** @type {any} */ (issue).assignee || ''}
            size=${Math.min(
              40,
              Math.max(12, (issue.assignee || '').length + 3)
            )}
            @keydown=${
              /** @param {KeyboardEvent} e */ (e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onAssigneeCancel();
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  onAssigneeSave();
                }
              }
            }
          />
          <button class="btn" style="margin-left:6px" @click=${onAssigneeSave}>
            Save
          </button>
          <button
            class="btn"
            style="margin-left:6px"
            @click=${onAssigneeCancel}
          >
            Cancel
          </button>`
      : html`${(() => {
          const raw = issue.assignee || '';
          const has = raw.trim().length > 0;
          const text = has ? raw : 'Unassigned';
          const cls = has ? 'editable' : 'editable muted';
          return html`<span
            class=${cls}
            tabindex="0"
            role="button"
            aria-label="Edit assignee"
            @click=${onAssigneeSpanClick}
            @keydown=${onAssigneeKeydown}
            >${text}</span
          >`;
        })()}`}`;
  }

  return { titleZone, statusSelect, prioritySelect, assigneeValue };
}
