// Detail section templates: dependency lists, editable text sections,
// labels, and comments. Bound to the detail view's event handlers.
import { html } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { parseView } from '../router.js';
import { issueHashFor } from '../utils/issue-url.js';
import { renderMarkdown } from '../utils/markdown.js';
import { createTypeBadge } from '../utils/type-badge.js';

/**
 * Format a date for display. Accepts ISO string or epoch ms.
 *
 * @param {string|number|null} [value]
 * @returns {string}
 */
export function formatCommentDate(value) {
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

/** @param {string} id */
function issueHref(id) {
  /** @type {'issues'|'epics'|'board'} */
  const view = parseView(window.location.hash || '');
  return issueHashFor(view, id);
}

/**
 * @typedef {import('./detail-template.js').IssueDetail} IssueDetail
 */

/**
 * @typedef {import('./detail-template.js').DetailUiState} DetailUiState
 */

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
 * Create the detail section templates bound to the view's event handlers.
 *
 * @param {Record<string, (...args: any[]) => any>} handlers - Detail view
 * event handlers, keyed by their names in detail.js.
 * @returns {{
 *   depsSection: (title: 'Dependencies'|'Dependents', items: Dependency[]) => import('lit-html').TemplateResult<1>,
 *   descBlock: (issue: IssueDetail, ui: DetailUiState) => import('lit-html').TemplateResult<1>,
 *   acceptBlock: (issue: IssueDetail, ui: DetailUiState) => import('lit-html').TemplateResult<1>,
 *   notesBlock: (issue: IssueDetail, ui: DetailUiState) => import('lit-html').TemplateResult<1>,
 *   designBlock: (issue: IssueDetail, ui: DetailUiState) => import('lit-html').TemplateResult<1>,
 *   labelsBlock: (issue: IssueDetail, ui: DetailUiState) => import('lit-html').TemplateResult<1>,
 *   commentsBlock: (issue: IssueDetail, ui: DetailUiState) => import('lit-html').TemplateResult<1>
 * }}
 */
export function createDetailSections(handlers) {
  const {
    navigateFn,
    makeDepAddClick,
    makeDepRemoveClick,
    editUnlessSelecting,
    onEditorInput,
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
    onDescKeydown,
    onDescEdit,
    onDescSave,
    onDescCancel,
    onDescEditableKeydown,
    onRemoveLabel,
    onLabelInput,
    onLabelKeydown,
    onAddLabel,
    onCommentInput,
    onCommentKeydown,
    onCommentSubmit
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
  function descBlock(issue, ui) {
    return ui.editing_text.description
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
  }

  /**
   * @param {IssueDetail} issue
   * @param {DetailUiState} ui
   */
  function acceptBlock(issue, ui) {
    // Normalize acceptance text: prefer issue.acceptance, fallback to acceptance_criteria from bd
    const acceptance_text = (() => {
      /** @type {any} */
      const any_issue = issue;
      const raw = String(
        issue.acceptance || any_issue.acceptance_criteria || ''
      );
      return raw;
    })();

    return ui.editing_text.acceptance
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
  }

  /**
   * @param {IssueDetail} issue
   * @param {DetailUiState} ui
   */
  function notesBlock(issue, ui) {
    // Notes: editable in-place similar to Description
    const notes_text = String(issue.notes || '');
    return ui.editing_text.notes
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
  }

  /**
   * @param {IssueDetail} issue
   * @param {DetailUiState} ui
   */
  function designBlock(issue, ui) {
    // Design section block
    const design_text = String(issue.design || '');
    return ui.editing_text.design
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
  }

  /**
   * @param {IssueDetail} issue
   * @param {DetailUiState} ui
   */
  function labelsBlock(issue, ui) {
    // Labels section
    const labels = Array.isArray(issue.labels) ? issue.labels : [];
    return html`<div class="props-card labels">
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
          type="text"
          placeholder="Label"
          size="12"
          .value=${live(ui.new_label_text)}
          @input=${onLabelInput}
          @keydown=${onLabelKeydown}
        />
        <button @click=${onAddLabel}>Add</button>
      </div>
    </div>`;
  }

  /**
   * @param {IssueDetail} issue
   * @param {DetailUiState} ui
   */
  function commentsBlock(issue, ui) {
    // Comments section
    const comments = Array.isArray(/** @type {any} */ (issue).comments)
      ? /** @type {Comment[]} */ (/** @type {any} */ (issue).comments)
      : [];
    return html`<div class="comments">
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
          .value=${live(ui.comment_text)}
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
  }

  return {
    depsSection,
    descBlock,
    acceptBlock,
    notesBlock,
    designBlock,
    labelsBlock,
    commentsBlock
  };
}
