import { afterEach, describe, expect, test, vi } from 'vitest';
import { createDetailView } from './detail.js';

/**
 * @param {HTMLElement} mount
 */
async function loadIssue(mount) {
  /** @type {any} */
  const issue = {
    id: 'UI-301',
    title: 'Fit',
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
      return id === 'detail:UI-301' ? [issue] : [];
    },
    subscribe() {
      return () => {};
    }
  };
  const view = createDetailView(mount, async () => issue, undefined, stores);
  await view.load('UI-301');
}

/**
 * @param {{ content: number, read: number }} heights
 */
function mockHeights(heights) {
  vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(
    () => heights.content
  );
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(
    () => heights.read
  );
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

describe('views/detail textarea fit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  for (const section of SECTIONS) {
    /**
     * @param {{ content: number, read: number }} heights
     */
    async function enterEdit(heights) {
      document.body.innerHTML =
        '<section class="panel"><div id="mount"></div></section>';
      const mount = /** @type {HTMLElement} */ (
        document.getElementById('mount')
      );
      await loadIssue(mount);
      mockHeights(heights);
      /** @type {HTMLElement} */ (
        mount.querySelector(section.selector)
      ).click();
      return /** @type {HTMLTextAreaElement} */ (
        mount.querySelector(section.textarea)
      );
    }

    test(`fits ${section.name} textarea to its content`, async () => {
      const ta = await enterEdit({ content: 320, read: 100 });

      expect(ta.style.height).toBe('320px');
    });

    test(`keeps ${section.name} read-mode height for short content`, async () => {
      const ta = await enterEdit({ content: 50, read: 200 });

      expect(ta.style.height).toBe('200px');
    });

    test(`grows ${section.name} textarea while typing`, async () => {
      const heights = { content: 320, read: 100 };
      const ta = await enterEdit(heights);

      heights.content = 500;
      ta.dispatchEvent(new Event('input'));

      expect(ta.style.height).toBe('500px');
    });
  }
});
