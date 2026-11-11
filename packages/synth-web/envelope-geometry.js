const nonnegative = (value, fallback = 0) => Number.isFinite(value) ? Math.max(0, value) : fallback;

/**
 * Envelope display geometry on one linear time axis (seconds).
 * `hold` places an illustrative key-up after decay; it is not a note duration.
 * A supplied span freezes the scale while editing. Endpoints may then exceed
 * x1: clipping the drawing and positioning accessible hit targets belong to
 * the renderer, and must not change the underlying time geometry.
 */
export function envelopeGeometry({attack, decay, sustain, release, height = 210, footerHeight = 60, span, hold = .25} = {}) {
  const A = nonnegative(attack), D = nonnegative(decay), R = nonnegative(release);
  hold = nonnegative(hold, .25);
  height = nonnegative(height, 210);
  footerHeight = nonnegative(footerHeight, 60);
  const level = Math.max(0, Math.min(1, Number.isFinite(sustain) ? sustain : 0));
  const x0 = 18, x1 = 402, yTop = 18;
  const yBottom = Math.max(yTop + 40, height - footerHeight - 8);
  const autoSpan = Math.max(.08, (A + D + hold + R) * 1.05);
  span = Number.isFinite(span) && span > 0 ? span : autoSpan;
  const x = seconds => x0 + seconds / span * (x1 - x0);
  return {
    x0, x1, yTop, yBottom,
    a: x(A), d: x(A + D), releaseStart: x(A + D + hold),
    r: x(A + D + hold + R), sy: yBottom - level * (yBottom - yTop),
    span, footerTop: height - footerHeight, hold,
  };
}
