import { describe, expect, test } from 'vitest';
import { createDetailView } from './detail.js';

/**
 * @param {HTMLElement} mount
 */
async function loadIssue(mount) {
  /** @type {any} */
  const issue = {
    id: 'UI-300',
    title: 'Selectable',
    description: 'Description body',
    acceptance: 'Acceptance body',
    notes: 'Notes body',
    design: 'Design body',
    status: 'open',
    priority: 2
  };
  const stores = {
    /** @param {string} id */
    snapshotFor(id) {
      return id === 'detail:UI-300' ? [issue] : [];
    },
    subscribe() {
      return () => {};
    }
  };
  const view = createDetailView(mount, async () => issue, undefined, stores);
  await view.load('UI-300');
}

/**
 * @param {HTMLElement} el
 */
function selectContents(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = /** @type {Selection} */ (window.getSelection());
  selection.removeAllRanges();
  selection.addRange(range);
}

const SECTIONS = [
  {
    name: 'description',
    selector: '#detail-root .md.editable',
    textarea: '.description textarea'
  },
  {
    name: 'acceptance',
    selector: '.acceptance .editable',
    textarea: '.acceptance textarea'
  },
  { name: 'notes', selector: '.notes .editable', textarea: '.notes textarea' },
  {
    name: 'design',
    selector: '.design .editable',
    textarea: '.design textarea'
  }
];

describe('views/detail text selection', () => {
  for (const section of SECTIONS) {
    test(`keeps ${section.name} read-only when click ends a text selection`, async () => {
      document.body.innerHTML =
        '<section class="panel"><div id="mount"></div></section>';
      const mount = /** @type {HTMLElement} */ (
        document.getElementById('mount')
      );
      await loadIssue(mount);
      const editable = /** @type {HTMLElement} */ (
        mount.querySelector(section.selector)
      );

      selectContents(editable);
      editable.click();

      expect(mount.querySelector(section.textarea)).toBeNull();
    });

    test(`enters ${section.name} edit mode on plain click`, async () => {
      document.body.innerHTML =
        '<section class="panel"><div id="mount"></div></section>';
      const mount = /** @type {HTMLElement} */ (
        document.getElementById('mount')
      );
      await loadIssue(mount);
      const editable = /** @type {HTMLElement} */ (
        mount.querySelector(section.selector)
      );

      /** @type {Selection} */ (window.getSelection()).removeAllRanges();
      editable.click();

      expect(mount.querySelector(section.textarea)).not.toBeNull();
    });
  }
});
