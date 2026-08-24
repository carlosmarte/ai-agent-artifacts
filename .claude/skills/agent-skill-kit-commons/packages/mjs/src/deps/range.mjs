const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * Parse a small semver range subset:
 *   - "^X.Y.Z"      caret  → [X.Y.Z, X+1.0.0)
 *   - "~X.Y.Z"      tilde  → [X.Y.Z, X.Y+1.0)
 *   - "X.Y.Z"       exact  → [X.Y.Z, X.Y.Z+1)
 *   - ">=A <B"      bounded
 *   - null/""       any    → matches anything
 */
export function parseRange(spec) {
  if (spec == null || spec === "") return { op: "any" };
  const s = String(spec).trim();
  if (s.startsWith("^")) {
    const m = s.slice(1).match(VERSION_RE);
    if (!m) throw new Error(`unparseable range: ${spec}`);
    const [, M, mi, p] = m;
    return {
      op: "caret",
      min: [+M, +mi, +p],
      maxExclusive: [+M + 1, 0, 0],
    };
  }
  if (s.startsWith("~")) {
    const m = s.slice(1).match(VERSION_RE);
    if (!m) throw new Error(`unparseable range: ${spec}`);
    const [, M, mi, p] = m;
    return {
      op: "tilde",
      min: [+M, +mi, +p],
      maxExclusive: [+M, +mi + 1, 0],
    };
  }
  if (VERSION_RE.test(s)) {
    const m = s.match(VERSION_RE);
    const [, M, mi, p] = m;
    return {
      op: "exact",
      min: [+M, +mi, +p],
      maxExclusive: [+M, +mi, +p + 1],
    };
  }
  const lo = s.match(/>=\s*(\d+\.\d+\.\d+)/);
  const hi = s.match(/<\s*(\d+\.\d+\.\d+)/);
  if (lo && hi) {
    const a = lo[1].match(VERSION_RE);
    const b = hi[1].match(VERSION_RE);
    return {
      op: "bounded",
      min: [+a[1], +a[2], +a[3]],
      maxExclusive: [+b[1], +b[2], +b[3]],
    };
  }
  throw new Error(`unparseable range: ${spec}`);
}

const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/**
 * Two half-open ranges [min, maxExclusive) intersect iff
 * max(a.min, b.min) < min(a.maxExclusive, b.maxExclusive).
 * "any" intersects with everything.
 */
export function intersects(a, b) {
  if (a.op === "any" || b.op === "any") return true;
  const lo = cmp(a.min, b.min) > 0 ? a.min : b.min;
  const hi = cmp(a.maxExclusive, b.maxExclusive) < 0 ? a.maxExclusive : b.maxExclusive;
  return cmp(lo, hi) < 0;
}
