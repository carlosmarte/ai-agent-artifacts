import { describe, it, expect } from "vitest";
import { truncateToBudget } from "../src/prompt/budget.mjs";

const E = (name, desc = "x") => ({ name, tier: "org", description: desc });

describe("truncateToBudget", () => {
  it("returns all entries when maxTokens is falsy", () => {
    const entries = [E("a"), E("b"), E("c")];
    expect(truncateToBudget(entries, null)).toEqual({ kept: entries, dropped: 0 });
    expect(truncateToBudget(entries, 0)).toEqual({ kept: entries, dropped: 0 });
  });

  it("returns empty/zero on empty entries", () => {
    expect(truncateToBudget([], 999)).toEqual({ kept: [], dropped: 0 });
  });

  it("drops trailing entries when budget is exceeded", () => {
    const entries = Array.from({ length: 10 }, (_, i) => E(`s${i}`, "x".repeat(20)));
    // each entry costs ~ 33 (overhead) + 2 (name) + 3 (tier) + 20 (desc) = 58 chars
    // budget = maxTokens*4. Pick maxTokens=30 → 120 chars - 39 (header) = 81 → 1 entry fits
    const r = truncateToBudget(entries, 30);
    expect(r.kept.length).toBeGreaterThan(0);
    expect(r.kept.length).toBeLessThan(entries.length);
    expect(r.dropped).toBe(entries.length - r.kept.length);
  });

  it("dropped count equals total minus kept", () => {
    const entries = Array.from({ length: 5 }, (_, i) => E(`s${i}`));
    const r = truncateToBudget(entries, 25);
    expect(r.dropped + r.kept.length).toBe(entries.length);
  });
});
