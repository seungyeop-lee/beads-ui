/**
 * Keyboard navigation for the Issues List view.
 *
 * Two layers over one delegated keydown listener on the mount element:
 * - Grid cell Up/Down when focus is inside the table (preserves column
 *   position, skips native editable controls).
 * - Row selection Up/Down and Enter-to-open based on the selected id.
 */

/**
 * @typedef {{
 *   getSelectedId: () => (string | null),
 *   setSelectedId: (id: string | null) => void,
 *   openIssue: (id: string) => void,
 *   requestRender: () => void
 * }} ListKeyboardDeps
 */

/**
 * Attach list keyboard navigation to a mount element.
 *
 * @param {HTMLElement} mount_element
 * @param {ListKeyboardDeps} deps
 */
export function attachListKeyboardNav(mount_element, deps) {
  const { getSelectedId, setSelectedId, openIssue, requestRender } = deps;

  mount_element.tabIndex = 0;
  mount_element.addEventListener('keydown', (ev) => {
    // Grid cell Up/Down navigation when focus is inside the table and not within
    // an editable control (input/textarea/select). Preserves column position.
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      const tgt = /** @type {HTMLElement} */ (ev.target);
      const table =
        tgt && typeof tgt.closest === 'function'
          ? tgt.closest('#list-root table.table')
          : null;
      if (table) {
        // Do not intercept when inside native editable controls
        const in_editable = Boolean(
          tgt &&
          typeof tgt.closest === 'function' &&
          (tgt.closest('input') ||
            tgt.closest('textarea') ||
            tgt.closest('select'))
        );
        if (!in_editable) {
          const cell =
            tgt && typeof tgt.closest === 'function' ? tgt.closest('td') : null;
          if (cell && cell.parentElement) {
            const row = /** @type {HTMLTableRowElement} */ (cell.parentElement);
            const tbody = /** @type {HTMLTableSectionElement|null} */ (
              row.parentElement
            );
            if (tbody && tbody.querySelectorAll) {
              const rows = Array.from(tbody.querySelectorAll('tr'));
              const row_idx = Math.max(0, rows.indexOf(row));
              const col_idx = cell.cellIndex || 0;
              const next_idx =
                ev.key === 'ArrowDown'
                  ? Math.min(row_idx + 1, rows.length - 1)
                  : Math.max(row_idx - 1, 0);
              const next_row = rows[next_idx];
              const next_cell =
                next_row && next_row.cells ? next_row.cells[col_idx] : null;
              if (next_cell) {
                const focusable = /** @type {HTMLElement|null} */ (
                  next_cell.querySelector(
                    'button:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href], select:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled])'
                  )
                );
                if (focusable && typeof focusable.focus === 'function') {
                  ev.preventDefault();
                  focusable.focus();
                  return;
                }
              }
            }
          }
        }
      }
    }

    const tbody = /** @type {HTMLTableSectionElement|null} */ (
      mount_element.querySelector('#list-root tbody')
    );
    const items = tbody ? tbody.querySelectorAll('tr') : [];
    if (items.length === 0) {
      return;
    }
    const selected_id = getSelectedId();
    let idx = 0;
    if (selected_id) {
      const arr = Array.from(items);
      idx = arr.findIndex((el) => {
        const did = el.getAttribute('data-issue-id') || '';
        return did === selected_id;
      });
      if (idx < 0) {
        idx = 0;
      }
    }
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      const next = items[Math.min(idx + 1, items.length - 1)];
      const next_id = next ? next.getAttribute('data-issue-id') : '';
      const set = next_id ? next_id : null;
      setSelectedId(set);
      requestRender();
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      const prev = items[Math.max(idx - 1, 0)];
      const prev_id = prev ? prev.getAttribute('data-issue-id') : '';
      const set = prev_id ? prev_id : null;
      setSelectedId(set);
      requestRender();
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const current = items[idx];
      const id = current ? current.getAttribute('data-issue-id') : '';
      if (id) {
        openIssue(id);
      }
    }
  });
}
