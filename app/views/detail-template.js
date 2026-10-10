// Issue detail template: renders one issue and its inline editing UI.
// Section and field markup live in detail-sections.js / detail-fields.js.
import { html } from 'lit-html';
import { createTypeBadge } from '../utils/type-badge.js';
import { createDetailFields } from './detail-fields.js';
import { createDetailSections, formatCommentDate } from './detail-sections.js';

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
 * @property {import('./detail-sections.js').Dependency[]} [dependencies]
 * @property {import('./detail-sections.js').Dependency[]} [dependents]
 * @property {import('./detail-sections.js').Comment[]} [comments]
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

/**
 * Create the detail template bound to the view's event handlers.
 *
 * @param {Record<string, (...args: any[]) => any>} handlers - Detail view
 * event handlers, keyed by their names in detail.js.
 * @returns {(issue: IssueDetail, ui: DetailUiState) => import('lit-html').TemplateResult<1>}
 */
export function createDetailTemplate(handlers) {
  const { onDeleteClick } = handlers;
  const fields = createDetailFields(handlers);
  const sections = createDetailSections(handlers);

  /**
   * @param {IssueDetail} issue
   * @param {DetailUiState} ui
   */
  function detailTemplate(issue, ui) {
    const title_zone = fields.titleZone(issue, ui);
    const status_select = fields.statusSelect(issue, ui);
    const priority_select = fields.prioritySelect(issue, ui);
    const assignee_value = fields.assigneeValue(issue, ui);
    const desc_block = sections.descBlock(issue, ui);
    const accept_block = sections.acceptBlock(issue, ui);
    const notes_block = sections.notesBlock(issue, ui);
    const labels_block = sections.labelsBlock(issue, ui);
    const design_block = sections.designBlock(issue, ui);
    const comments_block = sections.commentsBlock(issue, ui);

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
                <button
                  class="delete-issue-btn"
                  title="Delete issue"
                  aria-label="Delete issue"
                  @click=${onDeleteClick}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path
                      d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                    ></path>
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
              ${issue.close_reason
                ? html`<div class="prop">
                    <div class="label">Close Reason</div>
                    <div class="value">${issue.close_reason}</div>
                  </div>`
                : ''}
              <div class="prop">
                <div class="label">Priority</div>
                <div class="value">${priority_select}</div>
              </div>
              <div class="prop assignee">
                <div class="label">Assignee</div>
                <div class="value">${assignee_value}</div>
              </div>
              <div class="prop">
                <div class="label">Created</div>
                <div class="value">${formatCommentDate(issue.created_at)}</div>
              </div>
              <div class="prop">
                <div class="label">Updated</div>
                <div class="value">${formatCommentDate(issue.updated_at)}</div>
              </div>
              ${issue.status === 'closed' &&
              issue.closed_at !== undefined &&
              issue.closed_at !== null
                ? html`<div class="prop">
                    <div class="label">Closed</div>
                    <div class="value">
                      ${formatCommentDate(issue.closed_at)}
                    </div>
                  </div>`
                : ''}
            </div>
            ${labels_block}
            ${sections.depsSection('Dependencies', issue.dependencies || [])}
            ${sections.depsSection('Dependents', issue.dependents || [])}
          </div>
        </div>
      </div>
    `;
  }

  return detailTemplate;
}
