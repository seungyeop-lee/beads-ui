import { isKnownType, typeLabel } from './issue-type.js';

/**
 * Create a compact, colored badge for an issue type.
 *
 * @param {string | undefined | null} issue_type - Built-in bd issue type
 * @returns {HTMLSpanElement}
 */
export function createTypeBadge(issue_type) {
  const el = document.createElement('span');
  el.className = 'type-badge';

  const t = (issue_type || '').toString().toLowerCase();
  const known = isKnownType(t);
  el.classList.add(`type-badge--${known ? t : 'neutral'}`);
  el.setAttribute('role', 'img');
  const label = known ? typeLabel(t) : '—';
  el.setAttribute(
    'aria-label',
    known ? `Issue type: ${label}` : 'Issue type: unknown'
  );
  el.setAttribute('title', known ? `Type: ${label}` : 'Type: unknown');
  el.textContent = label;
  return el;
}
