// Issue detail template: renders one issue and its inline editing UI.
import { html } from 'lit-html';
import { parseView } from '../router.js';
import { issueHashFor } from '../utils/issue-url.js';
import { renderMarkdown } from '../utils/markdown.js';
import { emojiForPriority } from '../utils/priority-badge.js';
import { priority_levels } from '../utils/priority.js';
import { statusLabel } from '../utils/status.js';
import { createTypeBadge } from '../utils/type-badge.js';

/**
 * Format a date for display. Accepts ISO string or epoch ms.
 *
 * @param {string|number|null} [value]
 * @returns {string}
 */
function formatCommentDate(value) {
  if (value === undefined || value === null || value === '') return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(value);
  }
}

/**
 * @typedef {Object} Dependency
 * @property {string} id
 * @property {string} [title]
 * @property {string} [status]
 * @property {number} [priority]
 * @property {string} [issue_type]
 */

/**
 * @typedef {Object} Comment
 * @property {number} id
 * @property {string} [author]
 * @property {string} text
 * @property {string} [created_at]
 */

/**
 * @typedef {Object} IssueDetail
 * @property {string} id
 * @property {string} [title]
 * @property {string} [description]
 * @property {string} [design]
 * @property {string} [acceptance]
 * @property {string} [notes]
 * @property {string} [status]
 * @property {(string|null)} [close_reason]
 * @property {string} [assignee]
 * @property {number} [priority]
 * @property {string[]} [labels]
 * @property {Dependency[]} [dependencies]
 * @property {Dependency[]} [dependents]
 * @property {Comment[]} [comments]
 * @property {number} [created_at]
 * @property {number} [updated_at]
 * @property {(number|null)} [closed_at]
 */

/**
 * Per-render view state snapshot handed to the detail template.
 *
 * @typedef {Object} DetailUiState
 * @property {boolean} edit_title
 * @property {Record<'description'|'design'|'notes'|'acceptance', boolean>} editing_text
 * @property {boolean} pending
 * @property {boolean} edit_assignee
 * @property {string} new_label_text
 * @property {string} comment_text
 * @property {boolean} comment_pending
 */

/** @param {string} id */
function issueHref(id) {
  /** @type {'issues'|'epics'|'board'} */
  const view = parseView(window.location.hash || '');
  return issueHashFor(view, id);
}

/**
 * Create the detail template bound to the view's event handlers.
 *
 * @param {Record<string, (...args: any[]) => any>} handlers - Detail view
 * event handlers, keyed by their names in detail.js.
 * @returns {(issue: IssueDetail, ui: DetailUiState) => import('lit-html').TemplateResult<1>}
 */
export function createDetailTemplate(handlers) {
  const {
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
  } = handlers;

  /**
   * @param {'Dependencies'|'Dependents'} title
   * @param {Dependency[]} items
   */
  function depsSection(title, items) {
    const test_id =
      title === 'Dependencies' ? 'add-dependency' : 'add-dependent';
    return html`
      <div class="props-card">
        <div>
          <div class="props-card__title">${title}</div>
        </div>
        <ul>
          ${!items || items.length === 0
            ? null
            : items.map((dep) => {
                const did = dep.id;
                const href = issueHref(did);
                return html`<li
                  data-href=${href}
                  @click=${() => navigateFn(href)}
                >
                  ${createTypeBadge(dep.issue_type || '')}
                  <span class="text-truncate">${dep.title || ''}</span>
                  <button
                    aria-label=${`Remove dependency ${did}`}
                    @click=${makeDepRemoveClick(did, title)}
                  >
                    ×
                  </button>
                </li>`;
              })}
        </ul>
        <div class="props-card__footer">
          <input type="text" placeholder="Issue ID" data-testid=${test_id} />
          <button @click=${makeDepAddClick(items, title)}>Add</button>
        </div>
      </div>
    `;
  }

  /**
   * @param {IssueDetail} issue
   * @param {DetailUiState} ui
   */
  function detailTemplate(issue, ui) {
    const title_zone = ui.edit_title
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

    const status_select = html`<select
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

    const priority_select = html`<select
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

    const desc_block = ui.editing_text.description
      ? html`<div class="description">
          <textarea
            @keydown=${onDescKeydown}
            @input=${onEditorInput}
            .value=${issue.description || ''}
            rows="8"
            style="width:100%"
          ></textarea>
          <div class="editable-actions">
            <button @click=${onDescSave}>Save</button>
            <button @click=${onDescCancel}>Cancel</button>
          </div>
        </div>`
      : html`<div
          class="md editable"
          tabindex="0"
          role="button"
          aria-label="Edit description"
          @click=${editUnlessSelecting(onDescEdit)}
          @keydown=${onDescEditableKeydown}
        >
          ${(() => {
            const text = issue.description || '';
            if (text.trim() === '') {
              return html`<div class="muted">Description</div>`;
            }
            return renderMarkdown(text);
          })()}
        </div>`;

    // Normalize acceptance text: prefer issue.acceptance, fallback to acceptance_criteria from bd
    const acceptance_text = (() => {
      /** @type {any} */
      const any_issue = issue;
      const raw = String(
        issue.acceptance || any_issue.acceptance_criteria || ''
      );
      return raw;
    })();

    const accept_block = ui.editing_text.acceptance
      ? html`<div class="acceptance">
          ${acceptance_text.trim().length > 0
            ? html`<div class="props-card__title">Acceptance Criteria</div>`
            : ''}
          <textarea
            @keydown=${onAcceptKeydown}
            @input=${onEditorInput}
            .value=${acceptance_text}
            rows="6"
            style="width:100%"
          ></textarea>
          <div class="editable-actions">
            <button @click=${onAcceptSave}>Save</button>
            <button @click=${onAcceptCancel}>Cancel</button>
          </div>
        </div>`
      : html`<div class="acceptance">
          ${(() => {
            const text = acceptance_text;
            const has = text.trim().length > 0;
            return html`${has
                ? html`<div class="props-card__title">Acceptance Criteria</div>`
                : ''}
              <div
                class="md editable"
                tabindex="0"
                role="button"
                aria-label="Edit acceptance criteria"
                @click=${editUnlessSelecting(onAcceptEdit)}
                @keydown=${onAcceptEditableKeydown}
              >
                ${has
                  ? renderMarkdown(text)
                  : html`<div class="muted">Add acceptance criteria…</div>`}
              </div>`;
          })()}
        </div>`;

    // Notes: editable in-place similar to Description
    const notes_text = String(issue.notes || '');
    const notes_block = ui.editing_text.notes
      ? html`<div class="notes">
          ${notes_text.trim().length > 0
            ? html`<div class="props-card__title">Notes</div>`
            : ''}
          <textarea
            @keydown=${onNotesKeydown}
            @input=${onEditorInput}
            .value=${notes_text}
            rows="6"
            style="width:100%"
          ></textarea>
          <div class="editable-actions">
            <button @click=${onNotesSave}>Save</button>
            <button @click=${onNotesCancel}>Cancel</button>
          </div>
        </div>`
      : html`<div class="notes">
          ${(() => {
            const text = notes_text;
            const has = text.trim().length > 0;
            return html`${has
                ? html`<div class="props-card__title">Notes</div>`
                : ''}
              <div
                class="md editable"
                tabindex="0"
                role="button"
                aria-label="Edit notes"
                @click=${editUnlessSelecting(onNotesEdit)}
                @keydown=${onNotesEditableKeydown}
              >
                ${has
                  ? renderMarkdown(text)
                  : html`<div class="muted">Add notes…</div>`}
              </div>`;
          })()}
        </div>`;

    // Labels section
    const labels = Array.isArray(issue.labels) ? issue.labels : [];
    const labels_block = html`<div class="props-card labels">
      <div>
        <div class="props-card__title">Labels</div>
      </div>
      <ul>
        ${labels.map(
          (l) =>
            html`<li>
              <span class="badge" title=${l}
                >${l}
                <button
                  class="icon-button"
                  title="Remove label"
                  aria-label=${'Remove label ' + l}
                  @click=${() => onRemoveLabel(l)}
                  style="margin-left:6px"
                >
                  ×
                </button></span
              >
            </li>`
        )}
      </ul>
      <div class="props-card__footer">
        <input
          size="12"
          .value=${ui.new_label_text}
          @input=${onLabelInput}
          @keydown=${onLabelKeydown}
        />
        <button @click=${onAddLabel}>Add</button>
      </div>
    </div>`;

    // Design section block
    const design_text = String(issue.design || '');
    const design_block = ui.editing_text.design
      ? html`<div class="design">
          ${design_text.trim().length > 0
            ? html`<div class="props-card__title">Design</div>`
            : ''}
          <textarea
            @keydown=${onDesignKeydown}
            @input=${onEditorInput}
            .value=${design_text}
            rows="6"
            style="width:100%"
          ></textarea>
          <div class="editable-actions">
            <button @click=${onDesignSave}>Save</button>
            <button @click=${onDesignCancel}>Cancel</button>
          </div>
        </div>`
      : html`<div class="design">
          ${(() => {
            const text = design_text;
            const has = text.trim().length > 0;
            return html`${has
                ? html`<div class="props-card__title">Design</div>`
                : ''}
              <div
                class="md editable"
                tabindex="0"
                role="button"
                aria-label="Edit design"
                @click=${editUnlessSelecting(onDesignEdit)}
                @keydown=${onDesignEditableKeydown}
              >
                ${has
                  ? renderMarkdown(text)
                  : html`<div class="muted">Add design…</div>`}
              </div>`;
          })()}
        </div>`;

    // Comments section
    const comments = Array.isArray(/** @type {any} */ (issue).comments)
      ? /** @type {Comment[]} */ (/** @type {any} */ (issue).comments)
      : [];
    const comments_block = html`<div class="comments">
      <div class="props-card__title">Comments</div>
      ${comments.length === 0
        ? html`<div class="muted">No comments yet</div>`
        : comments.map(
            (c) => html`
              <div class="comment-item">
                <div class="comment-header">
                  <span class="comment-author">${c.author || 'Unknown'}</span>
                  <span class="comment-date"
                    >${formatCommentDate(c.created_at)}</span
                  >
                </div>
                <div class="comment-text">${c.text}</div>
              </div>
            `
          )}
      <div class="comment-input">
        <textarea
          placeholder="Add a comment... (Ctrl+Enter to submit)"
          rows="3"
          .value=${ui.comment_text}
          @input=${onCommentInput}
          @keydown=${onCommentKeydown}
          ?disabled=${ui.comment_pending}
        ></textarea>
        <button
          @click=${onCommentSubmit}
          ?disabled=${ui.comment_pending || !ui.comment_text.trim()}
        >
          ${ui.comment_pending ? 'Adding...' : 'Add Comment'}
        </button>
      </div>
    </div>`;

    return html`
      <div class="panel__body" id="detail-root">
        <div class="detail-layout">
          <div class="detail-main">
            ${title_zone} ${desc_block} ${design_block} ${notes_block}
            ${accept_block} ${comments_block}
          </div>
          <div class="detail-side">
            <div class="props-card">
              <div class="props-card__header">
                <div class="props-card__title">Properties</div>
                <button class="delete-issue-btn" title="Delete issue" aria-label="Delete issue" @click=${onDeleteClick}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                  <span class="tooltip">Delete issue</span>
                </button>
              </div>
                <div class="prop">
                  <div class="label">Type</div>
                  <div class="value">
                    ${createTypeBadge(/** @type {any} */ (issue).issue_type)}
                  </div>
                </div>
                <div class="prop">
                  <div class="label">Status</div>
                  <div class="value">${status_select}</div>
                </div>
                ${
                  issue.close_reason
                    ? html`<div class="prop">
                        <div class="label">Close Reason</div>
                        <div class="value">${issue.close_reason}</div>
                      </div>`
                    : ''
                }
                <div class="prop">
                  <div class="label">Priority</div>
                  <div class="value">${priority_select}</div>
                </div>
                <div class="prop assignee">
                  <div class="label">Assignee</div>
                  <div class="value">
                    ${
                      ui.edit_assignee
                        ? html`<input
                              type="text"
                              aria-label="Edit assignee"
                              .value=${
                                /** @type {any} */ (issue).assignee || ''
                              }
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
                            <button
                              class="btn"
                              style="margin-left:6px"
                              @click=${onAssigneeSave}
                            >
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
                          })()}`
                    }
                  </div>
                </div>
                <div class="prop">
                  <div class="label">Created</div>
                  <div class="value">${formatCommentDate(issue.created_at)}</div>
                </div>
                <div class="prop">
                  <div class="label">Updated</div>
                  <div class="value">${formatCommentDate(issue.updated_at)}</div>
                </div>
                ${
                  issue.status === 'closed' &&
                  issue.closed_at !== undefined &&
                  issue.closed_at !== null
                    ? html`<div class="prop">
                        <div class="label">Closed</div>
                        <div class="value">
                          ${formatCommentDate(issue.closed_at)}
                        </div>
                      </div>`
                    : ''
                }
              </div>
              ${labels_block}
              ${depsSection('Dependencies', issue.dependencies || [])}
              ${depsSection('Dependents', issue.dependents || [])}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return detailTemplate;
}
