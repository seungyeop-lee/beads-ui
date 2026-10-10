import { render } from 'lit-html';
import { createListSelectors } from '../data/list-selectors.js';
import { issueHashFor } from '../utils/issue-url.js';
import { debug } from '../utils/logging.js';
import { createIssueRowRenderer } from './issue-row.js';
import { attachListKeyboardNav } from './list-keyboard.js';
import { createListTemplate } from './list-template.js';

// List view implementation; requires a transport send function.

/**
 * @import { Issue } from './list-template.js'
 */

/**
 * Create the Issues List view.
 *
 * @param {HTMLElement} mount_element - Element to render into.
 * @param {(type: string, payload?: unknown) => Promise<unknown>} sendFn - RPC transport.
 * @param {(hash: string) => void} [navigateFn] - Navigation function (defaults to setting location.hash).
 * @param {{ getState: () => any, setState: (patch: any) => void, subscribe: (fn: (s:any)=>void)=>()=>void }} [store] - Optional state store.
 * @param {{ selectors: { getIds: (client_id: string) => string[] } }} [_subscriptions]
 * @param {{ snapshotFor?: (client_id: string) => any[], subscribe?: (fn: () => void) => () => void }} [issue_stores]
 * @returns {{ load: () => Promise<void>, destroy: () => void }} View API.
 */
export function createListView(
  mount_element,
  sendFn,
  navigateFn,
  store,
  _subscriptions = undefined,
  issue_stores = undefined
) {
  const log = debug('views:list');
  // Touch unused param to satisfy lint rules without impacting behavior
  /** @type {any} */ (void _subscriptions);
  /** @type {string[]} */
  let status_filters = [];
  /** @type {string} */
  let search_text = '';
  /** @type {Issue[]} */
  let issues_cache = [];
  /** @type {string[]} */
  let type_filters = [];
  /** @type {string | null} */
  let selected_id = store ? store.getState().selected_id : null;
  /** @type {null | (() => void)} */
  let unsubscribe = null;
  let status_dropdown_open = false;
  let type_dropdown_open = false;

  /**
   * Normalize legacy string filter to array format.
   *
   * @param {string | string[] | undefined} val
   * @returns {string[]}
   */
  function normalizeStatusFilter(val) {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val !== '' && val !== 'all') return [val];
    return [];
  }

  /**
   * Normalize legacy string filter to array format.
   *
   * @param {string | string[] | undefined} val
   * @returns {string[]}
   */
  function normalizeTypeFilter(val) {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val !== '') return [val];
    return [];
  }

  /**
   * Open an issue detail from the current view context.
   *
   * @param {string} id
   */
  function openIssueById(id) {
    const nav = navigateFn || ((h) => (window.location.hash = h));
    /** @type {'issues'|'epics'|'board'} */
    const view = store ? store.getState().view : 'issues';
    nav(issueHashFor(view, id));
  }

  /**
   * Track row selection locally and in the store (when set).
   *
   * @param {string | null} id
   */
  function setSelectedId(id) {
    if (store && id) {
      store.setState({ selected_id: id });
    }
    selected_id = id;
  }

  // Shared row renderer (used in template below)
  const row_renderer = createIssueRowRenderer({
    navigate: openIssueById,
    onUpdate: updateInline,
    requestRender: doRender,
    getSelectedId: () => selected_id,
    row_class: 'issue-row'
  });

  /**
   * Toggle a status filter chip.
   *
   * @param {string} status
   */
  const toggleStatusFilter = async (status) => {
    if (status === 'ready') {
      if (status_filters.includes('ready')) {
        status_filters = [];
      } else {
        status_filters = ['ready'];
      }
    } else {
      status_filters = status_filters.filter((s) => s !== 'ready');
      if (status_filters.includes(status)) {
        status_filters = status_filters.filter((s) => s !== status);
      } else {
        status_filters = [...status_filters, status];
      }
    }
    log('status toggle %s -> %o', status, status_filters);
    if (store) {
      store.setState({ filters: { status: status_filters } });
    }
    await load();
  };

  /**
   * Event: search input.
   */
  /**
   * @param {Event} ev
   */
  const onSearchInput = (ev) => {
    const input = /** @type {HTMLInputElement} */ (ev.currentTarget);
    search_text = input.value;
    log('search input %s', search_text);
    if (store) {
      store.setState({ filters: { search: search_text } });
    }
    doRender();
  };

  /**
   * Toggle a type filter chip.
   *
   * @param {string} type
   */
  const toggleTypeFilter = (type) => {
    if (type_filters.includes(type)) {
      type_filters = type_filters.filter((t) => t !== type);
    } else {
      type_filters = [...type_filters, type];
    }
    log('type toggle %s -> %o', type, type_filters);
    if (store) {
      store.setState({ filters: { type: type_filters } });
    }
    doRender();
  };

  /**
   * Toggle status dropdown open/closed.
   *
   * @param {Event} e
   */
  const toggleStatusDropdown = (e) => {
    e.stopPropagation();
    status_dropdown_open = !status_dropdown_open;
    type_dropdown_open = false;
    doRender();
  };

  /**
   * Toggle type dropdown open/closed.
   *
   * @param {Event} e
   */
  const toggleTypeDropdown = (e) => {
    e.stopPropagation();
    type_dropdown_open = !type_dropdown_open;
    status_dropdown_open = false;
    doRender();
  };

  const list_template = createListTemplate({
    toggleStatusDropdown,
    toggleTypeDropdown,
    toggleStatusFilter,
    toggleTypeFilter,
    onSearchInput,
    renderRow: row_renderer
  });

  /**
   * Render the current issues_cache with filters applied.
   */
  function doRender() {
    render(
      list_template({
        issues: issues_cache,
        status_filters,
        search_text,
        type_filters,
        status_dropdown_open,
        type_dropdown_open
      }),
      mount_element
    );
  }

  // Initialize filters from store on first render so reload applies persisted state
  if (store) {
    const s = store.getState();
    if (s && s.filters && typeof s.filters === 'object') {
      status_filters = normalizeStatusFilter(s.filters.status);
      search_text = s.filters.search || '';
      type_filters = normalizeTypeFilter(s.filters.type);
    }
  }
  // Initial values are reflected via bound `.value` in the template
  // Compose helpers: centralize membership + entity selection + sorting
  const selectors = issue_stores ? createListSelectors(issue_stores) : null;

  // Initial render (header + body shell with current state)
  doRender();
  // no separate ready checkbox when using select option

  // Keyboard navigation
  attachListKeyboardNav(mount_element, {
    getSelectedId: () => selected_id,
    setSelectedId,
    openIssue: openIssueById,
    requestRender: doRender
  });

  /**
   * Update minimal fields inline via ws mutations and refresh that row's data.
   *
   * @param {string} id
   * @param {{ [k: string]: any }} patch
   */
  async function updateInline(id, patch) {
    try {
      log('updateInline %s %o', id, Object.keys(patch));
      // Dispatch specific mutations based on provided keys
      if (typeof patch.title === 'string') {
        await sendFn('edit-text', { id, field: 'title', value: patch.title });
      }
      if (typeof patch.assignee === 'string') {
        await sendFn('update-assignee', { id, assignee: patch.assignee });
      }
      if (typeof patch.status === 'string') {
        await sendFn('update-status', { id, status: patch.status });
      }
      if (typeof patch.priority === 'number') {
        await sendFn('update-priority', { id, priority: patch.priority });
      }
    } catch {
      // ignore failures; UI state remains as-is
    }
  }

  /**
   * Load issues from local push stores and re-render.
   */
  async function load() {
    log('load');
    // Preserve scroll position to avoid jarring jumps on live refresh
    const beforeEl = /** @type {HTMLElement|null} */ (
      mount_element.querySelector('#list-root')
    );
    const prevScroll = beforeEl ? beforeEl.scrollTop : 0;
    // Compose items from subscriptions membership and issues store entities
    try {
      if (selectors) {
        issues_cache = /** @type {Issue[]} */ (
          selectors.selectIssuesFor('tab:issues')
        );
      } else {
        issues_cache = [];
      }
    } catch (err) {
      log('load failed: %o', err);
      issues_cache = [];
    }
    doRender();
    // Restore scroll position if possible
    try {
      const afterEl = /** @type {HTMLElement|null} */ (
        mount_element.querySelector('#list-root')
      );
      if (afterEl && prevScroll > 0) {
        afterEl.scrollTop = prevScroll;
      }
    } catch {
      // ignore
    }
  }

  // Click outside to close dropdowns
  /** @param {MouseEvent} e */
  const clickOutsideHandler = (e) => {
    const target = /** @type {HTMLElement|null} */ (e.target);
    if (target && !target.closest('.filter-dropdown')) {
      if (status_dropdown_open || type_dropdown_open) {
        status_dropdown_open = false;
        type_dropdown_open = false;
        doRender();
      }
    }
  };
  document.addEventListener('click', clickOutsideHandler);

  // Keep selection in sync with store
  if (store) {
    unsubscribe = store.subscribe((s) => {
      if (s.selected_id !== selected_id) {
        selected_id = s.selected_id;
        log('selected %s', selected_id || '(none)');
        doRender();
      }
      if (s.filters && typeof s.filters === 'object') {
        const next_status = normalizeStatusFilter(s.filters.status);
        const next_search = s.filters.search || '';
        let needs_render = false;
        const status_changed =
          JSON.stringify(next_status) !== JSON.stringify(status_filters);
        if (status_changed) {
          status_filters = next_status;
          // Reload on any status scope change to keep cache correct
          void load();
          return;
        }
        if (next_search !== search_text) {
          search_text = next_search;
          needs_render = true;
        }
        const next_type_arr = normalizeTypeFilter(s.filters.type);
        const type_changed =
          JSON.stringify(next_type_arr) !== JSON.stringify(type_filters);
        if (type_changed) {
          type_filters = next_type_arr;
          needs_render = true;
        }
        if (needs_render) {
          doRender();
        }
      }
    });
  }

  // Live updates: recompose and re-render when issue stores change
  if (selectors) {
    selectors.subscribe(() => {
      try {
        issues_cache = /** @type {Issue[]} */ (
          selectors.selectIssuesFor('tab:issues')
        );
        doRender();
      } catch {
        // ignore
      }
    });
  }

  return {
    load,
    destroy() {
      mount_element.replaceChildren();
      document.removeEventListener('click', clickOutsideHandler);
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    }
  };
}
