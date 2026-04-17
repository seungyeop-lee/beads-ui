/**
 * Shared sort comparators for issues lists.
 * Centralizes sorting so views and stores stay consistent.
 */

/**
 * @typedef {{ id: string, title?: string, status?: 'open'|'in_progress'|'closed', priority?: number, issue_type?: string, created_at?: number, updated_at?: number, closed_at?: number }} IssueLite
 */

/**
 * Compare by priority asc, then created_at asc, then id asc.
 *
 * @param {IssueLite} a
 * @param {IssueLite} b
 */
export function cmpPriorityThenCreated(a, b) {
  const pa = a.priority ?? 2;
  const pb = b.priority ?? 2;
  if (pa !== pb) {
    return pa - pb;
  }
  const ca = a.created_at ?? 0;
  const cb = b.created_at ?? 0;
  if (ca !== cb) {
    return ca < cb ? -1 : 1;
  }
  const ida = a.id;
  const idb = b.id;
  return ida < idb ? -1 : ida > idb ? 1 : 0;
}

/**
 * Status rank for epic ordering: in_progress (0) → open (1) → closed (2).
 *
 * @param {string | undefined} status
 */
function epicStatusRank(status) {
  if (status === 'in_progress') {
    return 0;
  }
  if (status === 'closed') {
    return 2;
  }
  return 1;
}

/**
 * Compare by status rank (in_progress → open → closed), then priority asc,
 * then created_at asc, then id asc.
 *
 * @param {IssueLite} a
 * @param {IssueLite} b
 */
export function cmpEpicOrder(a, b) {
  const sa = epicStatusRank(a.status);
  const sb = epicStatusRank(b.status);
  if (sa !== sb) {
    return sa - sb;
  }
  return cmpPriorityThenCreated(a, b);
}

/**
 * Compare by closed_at desc, then id asc for stability.
 *
 * @param {IssueLite} a
 * @param {IssueLite} b
 */
export function cmpClosedDesc(a, b) {
  const ca = a.closed_at ?? 0;
  const cb = b.closed_at ?? 0;
  if (ca !== cb) {
    return ca < cb ? 1 : -1;
  }
  const ida = a?.id;
  const idb = b?.id;
  return ida < idb ? -1 : ida > idb ? 1 : 0;
}
