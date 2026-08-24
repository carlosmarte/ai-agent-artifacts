import { describe, it, expect } from "vitest";
import { parseRange, intersects } from "../src/deps/range.mjs";
import { checkConflicts, checkUnpinned } from "../src/deps/conflict.mjs";

describe("parseRange", () => {
  it("parses caret", () => {
    expect(parseRange("^1.2.3")).toEqual({
      op: "caret",
      min: [1, 2, 3],
      maxExclusive: [2, 0, 0],
    });
  });
  it("parses tilde", () => {
    expect(parseRange("~1.2.3")).toEqual({
      op: "tilde",
      min: [1, 2, 3],
      maxExclusive: [1, 3, 0],
    });
  });
  it("parses exact", () => {
    expect(parseRange("1.2.3")).toEqual({
      op: "exact",
      min: [1, 2, 3],
      maxExclusive: [1, 2, 4],
    });
  });
  it("parses bounded", () => {
    expect(parseRange(">=1.0.0 <2.0.0")).toEqual({
      op: "bounded",
      min: [1, 0, 0],
      maxExclusive: [2, 0, 0],
    });
  });
  it("treats null/empty as any", () => {
    expect(parseRange(null)).toEqual({ op: "any" });
    expect(parseRange("")).toEqual({ op: "any" });
  });
});

describe("intersects", () => {
  it("returns true for overlapping caret ranges", () => {
    expect(intersects(parseRange("^1.0.0"), parseRange("^1.5.0"))).toBe(true);
  });
  it("returns false for non-overlapping caret ranges", () => {
    expect(intersects(parseRange("^1.0.0"), parseRange("^2.0.0"))).toBe(false);
  });
  it("returns false for adjacent tilde ranges", () => {
    expect(intersects(parseRange("~1.2.0"), parseRange("~1.3.0"))).toBe(false);
  });
  it("returns true when one side is any", () => {
    expect(intersects(parseRange(null), parseRange("^1.0.0"))).toBe(true);
  });
});

describe("checkConflicts + checkUnpinned", () => {
  function reg(edgesList) {
    return {
      nodes: new Map(
        edgesList.map(([from]) => [from, { name: from, tier: "team" }]),
      ),
      edges: new Map(
        edgesList.map(([from, deps]) => [
          from,
          deps.map((d) => ({
            name: d.name,
            version_range: d.version_range ?? null,
            origin: "in_repo",
            owner: null,
            repo: null,
          })),
        ]),
      ),
    };
  }

  it("emits E020 on incompatible ranges", () => {
    const r = reg([
      ["caller-a", [{ name: "dep", version_range: "^1.0.0" }]],
      ["caller-b", [{ name: "dep", version_range: "^2.0.0" }]],
    ]);
    const issues = checkConflicts(r);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("E020_CONFLICTING_RANGES");
    expect(issues[0].message).toContain("caller-a");
    expect(issues[0].message).toContain("caller-b");
  });

  it("emits no conflict for compatible ranges", () => {
    const r = reg([
      ["caller-a", [{ name: "dep", version_range: "^1.0.0" }]],
      ["caller-b", [{ name: "dep", version_range: "^1.5.0" }]],
    ]);
    expect(checkConflicts(r)).toEqual([]);
  });

  it("emits W020 for unpinned in-repo deps", () => {
    const r = reg([["caller-a", [{ name: "dep" }]]]);
    const issues = checkUnpinned(r);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("W020_UNPINNED_DEPENDENCY");
    expect(issues[0].message).toContain("caller-a");
    expect(issues[0].message).toContain("dep/v<X.Y.Z>");
  });
});
