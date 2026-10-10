import { html } from 'lit-html';
import { cmpClosedDesc, cmpPriorityThenCreated } from '../data/sort.js';
import { ISSUE_TYPES, typeLabel } from '../utils/issue-type.js';
import { statusLabel } from '../utils/status.js';

/**
 * @typedef {{ id: string, title?: string, status?: 'closed'|'open'|'in_progress', priority?: number, issue_type?: string, assignee?: string, labels?: string[] }} Issue
 */

/**
 * @typedef {{
 *   toggleStatusDropdown: (e: Event) => void,
 *   toggleTypeDropdown: (e: Event) => void,
 *   toggleStatusFilter: (status: string) => void,
 *   toggleTypeFilter: (type: string) => void,
 *   onSearchInput: (ev: Event) => void,
 *   renderRow: (it: Issue) => unknown
 * }} ListTemplateHandlers
 */

/**
 * @typedef {{
 *   issues: Issue[],
 *   status_filters: string[],
 *   search_text: string,
 *   type_filters: string[],
 *   status_dropdown_open: boolean,
 *   type_dropdown_open: boolean
 * }} ListTemplateState
 */

/**
 * Create the Issues List markup builder with filter/search/type composition
 * and status-grouped sorting applied inline.
 *
 * @param {ListTemplateHandlers} handlers
 * @returns {(state: ListTemplateState) => import('lit-html').TemplateResult}
 */
export function createListTemplate(handlers) {
  const {
    toggleStatusDropdown,
    toggleTypeDropdown,
    toggleStatusFilter,
    toggleTypeFilter,
    onSearchInput,
    renderRow
  } = handlers;

  /**
   * Get display text for dropdown trigger.
   *
   * @param {string[]} selected
   * @param {string} label
   * @param {(val: string) => string} formatter
   * @returns {string}
   */
  function getDropdownDisplayText(selected, label, formatter) {
    if (selected.length === 0) return `${label}: Any`;
    if (selected.length === 1) return `${label}: ${formatter(selected[0])}`;
    return `${label} (${selected.length})`;
  }

  /**
   * Build lit-html template for the list view.
   *
   * @param {ListTemplateState} state
   */
  function template(state) {
    let filtered = state.issues;
    if (
      state.status_filters.length > 0 &&
      !state.status_filters.includes('ready')
    ) {
      filtered = filtered.filter((it) =>
        state.status_filters.includes(String(it.status || ''))
      );
    }
    if (state.search_text) {
      const needle = state.search_text.toLowerCase();
      filtered = filtered.filter((it) => {
        const a = String(it.id).toLowerCase();
        const b = String(it.title || '').toLowerCase();
        return a.includes(needle) || b.includes(needle);
      });
    }
    if (state.type_filters.length > 0) {
      filtered = filtered.filter((it) =>
        state.type_filters.includes(String(it.issue_type || ''))
      );
    }
    // Sorting: split by status, sort per group, then concat open → in_progress → closed.
    // `ready` is an exclusive filter with only open (unblocked) items — skip grouping.
    if (
      state.status_filters.length === 1 &&
      state.status_filters[0] === 'ready'
    ) {
      filtered = filtered.slice().sort(cmpPriorityThenCreated);
    } else {
      /** @type {Issue[]} */
      const open_items = [];
      /** @type {Issue[]} */
      const in_progress_items = [];
      /** @type {Issue[]} */
      const closed_items = [];
      for (const it of filtered) {
        const s = String(it.status || '');
        if (s === 'closed') {
          closed_items.push(it);
        } else if (s === 'in_progress') {
          in_progress_items.push(it);
        } else {
          open_items.push(it);
        }
      }
      open_items.sort(cmpPriorityThenCreated);
      in_progress_items.sort(cmpPriorityThenCreated);
      closed_items.sort(cmpClosedDesc);
      filtered = [...open_items, ...in_progress_items, ...closed_items];
    }

    return html`
      <div class="panel__header">
        <div
          class="filter-dropdown ${state.status_dropdown_open ? 'is-open' : ''}"
        >
          <button
            class="filter-dropdown__trigger"
            @click=${toggleStatusDropdown}
          >
            ${getDropdownDisplayText(
              state.status_filters,
              'Status',
              statusLabel
            )}
            <span class="filter-dropdown__arrow">▾</span>
          </button>
          <div class="filter-dropdown__menu">
            ${['ready', 'open', 'in_progress', 'closed'].map(
              (s) => html`
                <label
                  class="filter-dropdown__option${state.status_filters.includes(
                    'ready'
                  ) && s !== 'ready'
                    ? ' is-disabled'
                    : ''}"
                >
                  <input
                    type="checkbox"
                    .checked=${state.status_filters.includes(s)}
                    ?disabled=${state.status_filters.includes('ready') &&
                    s !== 'ready'}
                    @change=${() => toggleStatusFilter(s)}
                  />
                  ${s === 'ready' ? 'Ready' : statusLabel(s)}
                </label>
              `
            )}
          </div>
        </div>
        <div
          class="filter-dropdown ${state.type_dropdown_open ? 'is-open' : ''}"
        >
          <button class="filter-dropdown__trigger" @click=${toggleTypeDropdown}>
            ${getDropdownDisplayText(state.type_filters, 'Types', typeLabel)}
            <span class="filter-dropdown__arrow">▾</span>
          </button>
          <div class="filter-dropdown__menu">
            ${ISSUE_TYPES.map(
              (t) => html`
                <label class="filter-dropdown__option">
                  <input
                    type="checkbox"
                    .checked=${state.type_filters.includes(t)}
                    @change=${() => toggleTypeFilter(t)}
                  />
                  ${typeLabel(t)}
                </label>
              `
            )}
          </div>
        </div>
        <input
          type="search"
          placeholder="Search…"
          @input=${onSearchInput}
          .value=${state.search_text}
        />
      </div>
      <div class="panel__body" id="list-root">
        ${filtered.length === 0
          ? html`<div class="issues-block">
              <div class="muted" style="padding:10px 12px;">No issues</div>
            </div>`
          : html`<div class="issues-block">
              <table
                class="table"
                role="grid"
                aria-rowcount=${String(filtered.length)}
                aria-colcount="6"
              >
                <colgroup>
                  <col style="width: 140px" />
                  <col style="width: 120px" />
                  <col />
                  <col style="width: 140px" />
                  <col style="width: 160px" />
                  <col style="width: 130px" />
                  <col style="width: 80px" />
                </colgroup>
                <thead>
                  <tr role="row">
                    <th role="columnheader">ID</th>
                    <th role="columnheader">Type</th>
                    <th role="columnheader">Title</th>
                    <th role="columnheader">Status</th>
                    <th role="columnheader">Assignee</th>
                    <th role="columnheader">Priority</th>
                    <th role="columnheader">Deps</th>
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  ${filtered.map((it) => renderRow(it))}
                </tbody>
              </table>
            </div>`}
      </div>
    `;
  }

  return template;
}
