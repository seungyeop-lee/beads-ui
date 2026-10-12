import { render } from 'lit-html';
import { describe, expect, test, vi } from 'vitest';
import { createIssueRowRenderer } from './issue-row.js';

/**
 * Render one issue row into a fresh container and return the <tr> element.
 *
 * @param {(it: any) => unknown} renderer
 * @param {any} it
 * @returns {HTMLTableRowElement}
 */
function renderRow(renderer, it) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  render(renderer(it), container);
  const row = /** @type {HTMLTableRowElement} */ (
    container.querySelector('tr')
  );
  if (!row) {
    throw new Error('row not rendered');
  }
  return row;
}

/**
 * Create a live row bound to a re-rendering container (for inline edits).
 *
 * @param {(id: string, patch: { [key: string]: unknown }) => Promise<void>} onUpdate
 */
function makeEditableRow(onUpdate) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  /**
   * @param {any} it
   */
  const renderRowLive = (it) => {
    const renderer = createIssueRowRenderer({
      navigate: () => {},
      onUpdate,
      requestRender: () => render(renderer(it), container),
      row_class: 'issue-row'
    });
    render(renderer(it), container);
    return /** @type {HTMLTableRowElement} */ (container.querySelector('tr'));
  };
  return { container, renderRowLive };
}

/**
 * @param {HTMLElement} el
 * @param {string} key
 */
function keyDown(el, key) {
  el.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  );
}

describe('issue row renderer', () => {
  test('renders a row with id, badges, selects and dep counts', () => {
    const renderer = createIssueRowRenderer({
      navigate: () => {},
      onUpdate: async () => {},
      requestRender: () => {}
    });
    const row = renderRow(renderer, {
      id: 'bdui-1',
      title: 'Fix thing',
      status: 'open',
      priority: 2,
      issue_type: 'task',
      assignee: 'dev',
      dependency_count: 2,
      dependent_count: 1
    });
    expect(row.className).toContain('issue-row');
    expect(row.getAttribute('data-issue-id')).toBe('bdui-1');
    const cells = row.querySelectorAll('td[role="gridcell"]');
    expect(cells.length).toBe(7);
    expect(cells[0].textContent).toContain('bdui-1');
    const status_select = /** @type {HTMLSelectElement} */ (
      cells[3].querySelector('select')
    );
    expect(status_select.value).toBe('open');
    const priority_select = /** @type {HTMLSelectElement} */ (
      cells[5].querySelector('select')
    );
    expect(priority_select.value).toBe('2');
    const deps = cells[6].textContent || '';
    expect(deps).toContain('→2');
    expect(deps).toContain('←1');
  });

  test('marks the row selected when getSelectedId matches', () => {
    const renderer = createIssueRowRenderer({
      navigate: () => {},
      onUpdate: async () => {},
      requestRender: () => {},
      getSelectedId: () => 'bdui-1'
    });
    const row = renderRow(renderer, { id: 'bdui-1', title: 'T' });
    expect(row.className).toContain('selected');
  });

  test('title click and Enter open the issue; other cells do not', () => {
    const navigate = vi.fn();
    const renderer = createIssueRowRenderer({
      navigate,
      onUpdate: async () => {},
      requestRender: () => {}
    });
    const row = renderRow(renderer, { id: 'bdui-9', title: 'T' });
    const title = /** @type {HTMLElement} */ (row.querySelector('.row-title'));
    expect(title.getAttribute('aria-label')).toBe('Open issue');
    keyDown(title, 'Enter');
    title.click();
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledWith('bdui-9');

    // Clicking outside the title (id cell) must not open the detail view.
    row.querySelector('td')?.click();
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  test('title inline edit commits on Enter and cancels on Escape', async () => {
    const onUpdate = vi.fn(async () => {});
    const { container, renderRowLive } = makeEditableRow(onUpdate);
    const row = renderRowLive({ id: 'bdui-2', title: 'Old' });
    const edit_btn = /** @type {HTMLElement} */ (
      row.querySelector('.row-edit-btn')
    );
    expect(edit_btn.getAttribute('aria-label')).toBe('Edit title');
    edit_btn.click();
    let input = /** @type {HTMLInputElement} */ (
      container.querySelector('.inline-edit')
    );
    expect(input).toBeTruthy();

    // Escape cancels without update
    keyDown(input, 'Escape');
    expect(onUpdate).not.toHaveBeenCalled();

    // Enter with a changed title commits once
    edit_btn.click();
    input = /** @type {HTMLInputElement} */ (
      container.querySelector('.inline-edit')
    );
    input.value = 'New title';
    keyDown(input, 'Enter');
    await Promise.resolve();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith('bdui-2', { title: 'New title' });
  });

  test('assignee inline edit commits on blur and shows placeholder', async () => {
    const onUpdate = vi.fn(async () => {});
    const { container, renderRowLive } = makeEditableRow(onUpdate);
    const row = renderRowLive({ id: 'bdui-3', title: 'T', assignee: '' });
    const span = /** @type {HTMLElement} */ (
      row.querySelector('.editable.muted')
    );
    expect(span.textContent).toBe('Unassigned');
    span.click();
    const input = /** @type {HTMLInputElement} */ (
      container.querySelector('input.inline-edit')
    );
    expect(input).toBeTruthy();
    input.value = 'dev';
    input.dispatchEvent(new Event('blur'));
    await Promise.resolve();
    expect(onUpdate).toHaveBeenCalledWith('bdui-3', { assignee: 'dev' });
  });

  test('status and priority selects dispatch typed patches', async () => {
    const onUpdate = vi.fn(async () => {});
    const renderer = createIssueRowRenderer({
      navigate: () => {},
      onUpdate,
      requestRender: () => {}
    });
    const row = renderRow(renderer, {
      id: 'bdui-4',
      title: 'T',
      status: 'open',
      priority: 2
    });
    const selects = row.querySelectorAll('select');
    const status_select = /** @type {HTMLSelectElement} */ (selects[0]);
    const priority_select = /** @type {HTMLSelectElement} */ (selects[1]);

    status_select.value = 'closed';
    status_select.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
    expect(onUpdate).toHaveBeenCalledWith('bdui-4', { status: 'closed' });

    priority_select.value = '1';
    priority_select.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
    expect(onUpdate).toHaveBeenCalledWith('bdui-4', { priority: 1 });
  });
});
