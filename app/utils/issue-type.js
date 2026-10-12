/**
 * Built-in issue types in canonical order for dropdowns and filters.
 * Mirrors `bd` CLI's built-in set; custom types (types.custom config) are
 * rendered via the neutral badge fallback.
 *
 * @type {Array<'bug'|'feature'|'task'|'epic'|'chore'|'decision'|'spike'|'story'|'milestone'>}
 */
export const ISSUE_TYPES = [
  'bug',
  'feature',
  'task',
  'epic',
  'chore',
  'decision',
  'spike',
  'story',
  'milestone'
];

/**
 * Check whether a value is a known built-in issue type.
 *
 * @param {string | null | undefined} type
 * @returns {boolean}
 */
export function isKnownType(type) {
  const t = (type || '').toString().toLowerCase();
  return /** @type {readonly string[]} */ (ISSUE_TYPES).includes(t);
}
/**
 * Return a human-friendly label for an issue type.
 *
 * @param {string | null | undefined} type
 * @returns {string}
 */
export function typeLabel(type) {
  const t = (type || '').toString().toLowerCase();
  if (!isKnownType(t)) {
    return '';
  }
  return t.charAt(0).toUpperCase() + t.slice(1);
}
