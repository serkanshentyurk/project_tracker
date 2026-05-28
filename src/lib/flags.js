/**
 * flags.js — threshold-based "needs attention" rules for sessions.
 *
 * Single source of truth. Edit FLAG_RULES to change what counts as a
 * concern. Every page (Animal Detail, Animals list, Overview digest,
 * Sessions table) imports from here so the meaning of a flag is
 * consistent across the whole app.
 *
 * A rule reads one metric out of a session's `metrics` object and, if
 * the test passes, contributes a flag. Levels:
 *   'danger' — red, genuinely concerning
 *   'warn'   — amber, worth a look
 *
 * Deliberately small. Over-flagging trains people to ignore flags.
 * Add a rule only when it reliably indicates a struggling animal.
 */

export const FLAG_RULES = [
  {
    key: 'accuracy',
    level: 'danger',
    msg: 'Below chance',
    test: (v) => v != null && !isNaN(v) && v < 0.5,
  },
  {
    key: 'accuracy',
    level: 'warn',
    msg: 'Below 0.7',
    test: (v) => v != null && !isNaN(v) && v >= 0.5 && v < 0.7,
  },
  {
    key: 'side_bias',
    level: 'warn',
    msg: 'High side bias',
    test: (v) => v != null && !isNaN(v) && Math.abs(v) > 0.3,
  },
  {
    key: 'abort_rate',
    level: 'warn',
    msg: 'High abort rate',
    test: (v) => v != null && !isNaN(v) && v > 0.3,
  },
];

/**
 * Evaluate all rules against one session's metrics.
 * Returns an array of { key, level, msg, value }.
 */
export function flagSession(metrics) {
  if (!metrics) return [];
  const out = [];
  for (const rule of FLAG_RULES) {
    const v = metrics[rule.key];
    if (rule.test(v)) {
      out.push({ key: rule.key, level: rule.level, msg: rule.msg, value: v });
    }
  }
  return out;
}

/**
 * Worst level present in a flag list: 'danger' > 'warn' > null.
 */
export function worstLevel(flags) {
  if (!flags || flags.length === 0) return null;
  if (flags.some((f) => f.level === 'danger')) return 'danger';
  return 'warn';
}

/**
 * Colour for a level (matches the app's CSS variable palette).
 */
export function levelColour(level) {
  if (level === 'danger') return 'var(--danger, #ef4444)';
  if (level === 'warn') return 'var(--warn, #f59e0b)';
  return 'var(--success, #22c55e)';
}

/**
 * Given an animal's sessions (sorted or not), return the flags for the
 * most recent session. This is what the Animals list / Overview digest
 * use to show "is this animal currently okay".
 */
export function flagsForLatestSession(sessions) {
  if (!sessions || sessions.length === 0) return [];
  const latest = [...sessions].sort((a, b) =>
    (b.date || '').localeCompare(a.date || '')
  )[0];
  return flagSession(latest?.metrics);
}
