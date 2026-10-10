import { describe, expect, test, vi } from 'vitest';
import { createDetailView } from './detail.js';

function mountDiv() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return div;
}

describe('detail view labels', () => {
  test('shows labels and allows add/remove', async () => {
    const mount = mountDiv();
    let current = {
      id: 'UI-5',
      title: 'With labels',
      status: 'open',
      priority: 2,
      labels: ['frontend']
    };
    const stores = {
      /** @param {string} id */
      snapshotFor(id) {
        return id === 'detail:UI-5' ? [current] : [];
      },
      subscribe() {
        return () => {};
      }
    };
    const sendFn = vi.fn(async (type, payload) => {
      if (type === 'label-add') {
        current = { ...current, labels: [...current.labels, payload.label] };
        return current;
      }
      if (type === 'label-remove') {
        current = {
          ...current,
          labels: current.labels.filter((l) => l !== payload.label)
        };
        return current;
      }
      return current;
    });

    const view = createDetailView(mount, sendFn, undefined, stores);
    await view.load('UI-5');

    // Initial chip present
    expect(mount.querySelectorAll('.labels .badge').length).toBe(1);

    // Add a label via input + Enter
    const input = /** @type {HTMLInputElement} */ (
      mount.querySelector('.labels input')
    );
    input.value = 'backend';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    await Promise.resolve();

    expect(sendFn).toHaveBeenCalledWith('label-add', {
      id: 'UI-5',
      label: 'backend'
    });
    expect(mount.querySelectorAll('.labels .badge').length).toBe(2);

    // Remove the first label by clicking the × button
    const removeBtn = /** @type {HTMLButtonElement} */ (
      mount.querySelector('.labels .badge button')
    );
    removeBtn.click();
    await Promise.resolve();
    expect(sendFn).toHaveBeenCalledWith('label-remove', {
      id: 'UI-5',
      label: 'frontend'
    });
    expect(mount.querySelectorAll('.labels .badge').length).toBe(1);
  });

  test('label-add reply without comments keeps title and comments rendered', async () => {
    const mount = mountDiv();
    let current = {
      id: 'UI-6',
      title: 'Keep rendering',
      status: 'open',
      priority: 2,
      labels: ['alpha'],
      comments: [{ author: 'me', text: 'prior comment', created_at: 1 }]
    };
    const stores = {
      /** @param {string} id */
      snapshotFor(id) {
        return id === 'detail:UI-6' ? [current] : [];
      },
      subscribe() {
        return () => {};
      }
    };
    const sendFn = vi.fn(async () => {
      current = { ...current, labels: [...current.labels, 'beta'] };
      // Realistic `bd show --json` reply: no comments array, only the count.
      const { comments, ...reply } = current;
      return { ...reply, comment_count: comments.length };
    });

    const view = createDetailView(mount, sendFn, undefined, stores);
    await view.load('UI-6');
    expect(mount.querySelectorAll('.comment-item').length).toBe(1);

    const input = /** @type {HTMLInputElement} */ (
      mount.querySelector('.labels input')
    );
    input.value = 'beta';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }

    expect(mount.querySelector('h2 .editable')?.textContent).toBe(
      'Keep rendering'
    );
    expect(mount.querySelectorAll('.labels .badge').length).toBe(2);
    expect(mount.querySelectorAll('.comment-item').length).toBe(1);
    expect(input.value).toBe('');
  });

  test('label-add reply shaped as an array is ignored instead of blanking the view', async () => {
    const mount = mountDiv();
    const current = {
      id: 'UI-7',
      title: 'Array reply',
      status: 'open',
      priority: 2,
      labels: ['alpha']
    };
    const stores = {
      /** @param {string} id */
      snapshotFor(id) {
        return id === 'detail:UI-7' ? [current] : [];
      },
      subscribe() {
        return () => {};
      }
    };
    const sendFn = vi.fn(async () => [{ ...current, labels: ['beta'] }]);

    const view = createDetailView(mount, sendFn, undefined, stores);
    await view.load('UI-7');

    const input = /** @type {HTMLInputElement} */ (
      mount.querySelector('.labels input')
    );
    input.value = 'beta';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }

    expect(mount.querySelector('h2 .editable')?.textContent).toBe(
      'Array reply'
    );
    expect(mount.querySelectorAll('.labels .badge').length).toBe(1);
  });
});
