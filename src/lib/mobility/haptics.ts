/**
 * Haptic tapestry — Web Vibration API patterns. No-op where unsupported
 * (desktop browsers, iOS Safari). Durations in ms.
 */
function buzz(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* unsupported */
  }
}

/** Light crisp tick — snapping between sheet tiers, selecting a chip. */
export const hapticTick = () => buzz(8);

/** Deep resonant thud — locking in a route / completing a handoff. */
export const hapticThud = () => buzz([30, 40, 50]);

/** Gentle double-pulse — approaching a transfer node, confirming a report. */
export const hapticDoublePulse = () => buzz([15, 60, 15]);
