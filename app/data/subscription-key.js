/**
 * Subscription key derivation shared by the server registry and the client
 * stores. Both sides must derive identical keys from a subscription spec —
 * the server routes `list-delta` events by this key and the client applies
 * them to the same key — so a single implementation prevents silent drift.
 */

/**
 * @typedef {{ type: string, params?: Record<string, string|number|boolean> }} SubscriptionSpec
 */

/**
 * Generate a stable subscription key string from a spec. Sorts params keys.
 *
 * @param {SubscriptionSpec} spec
 * @returns {string}
 */
export function keyOf(spec) {
  const type = String(spec.type || '').trim();
  /** @type {Record<string, string>} */
  const flat = {};
  if (spec.params && typeof spec.params === 'object') {
    const keys = Object.keys(spec.params).sort();
    for (const k of keys) {
      const v = spec.params[k];
      flat[k] = String(v);
    }
  }
  const enc = new URLSearchParams(flat).toString();
  return enc.length > 0 ? `${type}?${enc}` : type;
}
