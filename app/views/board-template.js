import { html } from 'lit-html';
import { createIssueIdRenderer } from '../utils/issue-id-renderer.js';
import { createPriorityBadge } from '../utils/priority-badge.js';
import { createTypeBadge } from '../utils/type-badge.js';

/**
 * @typedef {{
 *   id: string,
 *   title?: string,
 *   status?: 'open'|'in_progress'|'closed',
 *   priority?: number,
 *   issue_type?: string,
 *   created_at?: number,
 *   updated_at?: number,
 *   closed_at?: number
 * }} IssueLite
 */

/**
 * @typedef {{
 *   onClosedFilterChange: (ev: Event) => void,
 *   onCardClick: (ev: MouseEvent, id: string) => void,
 *   onDragStart: (ev: DragEvent, id: string) => void,
 *   onDragEnd: (ev: DragEvent) => void
 * }} BoardTemplateHandlers
 */

/**
 * @typedef {{
 *   blocked: IssueLite[],
 *   ready: IssueLite[],
 *   in_progress: IssueLite[],
 *   closed: IssueLite[],
 *   closed_filter_mode: 'today'|'3'|'7'
 * }} BoardTemplateState
 */

/**
 * Create the Board markup builder.
 *
 * @param {BoardTemplateHandlers} handlers
 * @returns {(state: BoardTemplateState) => import('lit-html').TemplateResult}
 */
export function createBoardTemplate(handlers) {
  const { onClosedFilterChange, onCardClick, onDragStart, onDragEnd } =
    handlers;

  /**
   * @param {BoardTemplateState} state
   */
  function template(state) {
    return html`
      <div class="panel__body board-root">
        ${columnTemplate(
          'Blocked',
          'blocked-col',
          state.blocked,
          state.closed_filter_mode
        )}
        ${columnTemplate(
          'Ready',
          'ready-col',
          state.ready,
          state.closed_filter_mode
        )}
        ${columnTemplate(
          'In Progress',
          'in-progress-col',
          state.in_progress,
          state.closed_filter_mode
        )}
        ${columnTemplate(
          'Closed',
          'closed-col',
          state.closed,
          state.closed_filter_mode
        )}
      </div>
    `;
  }

  /**
   * @param {string} title
   * @param {string} id
   * @param {IssueLite[]} items
   * @param {'today'|'3'|'7'} closed_filter_mode
   */
  function columnTemplate(title, id, items, closed_filter_mode) {
    const item_count = Array.isArray(items) ? items.length : 0;
    const count_label = item_count === 1 ? '1 issue' : `${item_count} issues`;
    return html`
      <section class="board-column" id=${id}>
        <header
          class="board-column__header"
          id=${id + '-header'}
          role="heading"
          aria-level="2"
        >
          <div class="board-column__title">
            <span class="board-column__title-text">${title}</span>
            <span class="badge board-column__count" aria-label=${count_label}>
              ${item_count}
            </span>
          </div>
          ${id === 'closed-col'
            ? html`<label class="board-closed-filter">
                <span class="visually-hidden">Filter closed issues</span>
                <select
                  id="closed-filter"
                  aria-label="Filter closed issues"
                  @change=${onClosedFilterChange}
                >
                  <option
                    value="today"
                    ?selected=${closed_filter_mode === 'today'}
                  >
                    Today
                  </option>
                  <option value="3" ?selected=${closed_filter_mode === '3'}>
                    Last 3 days
                  </option>
                  <option value="7" ?selected=${closed_filter_mode === '7'}>
                    Last 7 days
                  </option>
                </select>
              </label>`
            : ''}
        </header>
        <div
          class="board-column__body"
          role="list"
          aria-labelledby=${id + '-header'}
        >
          ${items.map((it) => cardTemplate(it))}
        </div>
      </section>
    `;
  }

  /**
   * @param {IssueLite} it
   */
  function cardTemplate(it) {
    return html`
      <article
        class="board-card"
        data-issue-id=${it.id}
        role="listitem"
        tabindex="-1"
        draggable="true"
        @click=${(/** @type {MouseEvent} */ ev) => onCardClick(ev, it.id)}
        @dragstart=${(/** @type {DragEvent} */ ev) => onDragStart(ev, it.id)}
        @dragend=${onDragEnd}
      >
        <div class="board-card__title text-truncate">
          ${it.title || '(no title)'}
        </div>
        <div class="board-card__meta">
          ${createTypeBadge(it.issue_type)} ${createPriorityBadge(it.priority)}
          ${createIssueIdRenderer(it.id, { class_name: 'mono' })}
        </div>
      </article>
    `;
  }

  return template;
}
