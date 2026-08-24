import { describe, it, expect } from "vitest";
import { topoSort, findMissingTargets } from "../src/deps/toposort.mjs";
import { checkInversions } from "../src/deps/inversion.mjs";

function reg(nodes, edges) {
  return {
    nodes: new Map(nodes.map((n) => [n.name, n])),
    edges: new Map(
      edges.map(([from, deps]) => [
        from,
        deps.map((d) =>
          typeof d === "string"
            ? { name: d, version_range: null, origin: "in_repo", owner: null, repo: null }
            : d,
        ),
      ]),
    ),
  };
}

describe("topoSort", () => {
  it("returns empty order for empty registry", () => {
    expect(topoSort(reg([], []))).toEqual({ order: [], cycles: [] });
  });

  it("returns single node for a single skill", () => {
    const r = reg([{ name: "a", tier: "org" }], []);
    expect(topoSort(r)).toEqual({ order: ["a"], cycles: [] });
  });

  it("topologically sorts a linear chain A -> B -> C", () => {
    const r = reg(
      [
        { name: "a", tier: "team" },
        { name: "b", tier: "team" },
        { name: "c", tier: "team" },
      ],
      [
        ["a", ["b"]],
        ["b", ["c"]],
      ],
    );
    const { order, cycles } = topoSort(r);
    expect(cycles).toEqual([]);
    // c must come before b, b before a (reverse-post-order: deps first)
    expect(order.indexOf("c")).toBeLessThan(order.indexOf("b"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("a"));
  });

  it("handles a diamond: A -> B,C; B -> D; C -> D", () => {
    const r = reg(
      [
        { name: "a", tier: "team" },
        { name: "b", tier: "team" },
        { name: "c", tier: "team" },
        { name: "d", tier: "team" },
      ],
      [
        ["a", ["b", "c"]],
        ["b", ["d"]],
        ["c", ["d"]],
      ],
    );
    const { order, cycles } = topoSort(r);
    expect(cycles).toEqual([]);
    expect(order).toContain("d");
    expect(order.indexOf("d")).toBeLessThan(order.indexOf("b"));
    expect(order.indexOf("d")).toBeLessThan(order.indexOf("c"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("a"));
    expect(order.indexOf("c")).toBeLessThan(order.indexOf("a"));
  });

  it("detects a simple 2-cycle: A -> B -> A", () => {
    const r = reg(
      [
        { name: "a", tier: "team" },
        { name: "b", tier: "team" },
      ],
      [
        ["a", ["b"]],
        ["b", ["a"]],
      ],
    );
    const { cycles } = topoSort(r);
    expect(cycles.length).toBeGreaterThanOrEqual(1);
    expect(cycles[0][0]).toBe(cycles[0][cycles[0].length - 1]);
  });

  it("detects a complex 3-cycle: A -> B -> C -> A", () => {
    const r = reg(
      [
        { name: "a", tier: "team" },
        { name: "b", tier: "team" },
        { name: "c", tier: "team" },
      ],
      [
        ["a", ["b"]],
        ["b", ["c"]],
        ["c", ["a"]],
      ],
    );
    const { cycles } = topoSort(r);
    expect(cycles.length).toBeGreaterThanOrEqual(1);
    const cyc = cycles[0];
    expect(cyc[0]).toBe(cyc[cyc.length - 1]);
    expect(new Set(cyc).size).toBe(3);
  });
});

describe("findMissingTargets", () => {
  it("flags an in-repo dep pointing at a non-existent skill", () => {
    const r = reg([{ name: "a", tier: "team" }], [["a", ["b"]]]);
    expect(findMissingTargets(r)).toEqual([{ from: "a", to: "b" }]);
  });

  it("ignores cross-repo deps", () => {
    const r = reg(
      [{ name: "a", tier: "team" }],
      [
        [
          "a",
          [
            {
              name: "x",
              version_range: null,
              origin: "cross_repo",
              owner: "acme",
              repo: "g",
            },
          ],
        ],
      ],
    );
    expect(findMissingTargets(r)).toEqual([]);
  });
});

describe("checkInversions", () => {
  it("flags org -> team as an inversion (downward)", () => {
    const r = reg(
      [
        { name: "org-a", tier: "org" },
        { name: "team-b", tier: "team" },
      ],
      [["org-a", ["team-b"]]],
    );
    const inv = checkInversions(r);
    expect(inv).toEqual([
      { from: "org-a", to: "team-b", fromTier: "org", toTier: "team" },
    ]);
  });

  it("does not flag team -> org (upward is allowed)", () => {
    const r = reg(
      [
        { name: "team-a", tier: "team" },
        { name: "org-b", tier: "org" },
      ],
      [["team-a", ["org-b"]]],
    );
    expect(checkInversions(r)).toEqual([]);
  });

  it("does not flag cross-repo deps", () => {
    const r = reg(
      [{ name: "org-a", tier: "org" }],
      [
        [
          "org-a",
          [
            {
              name: "x",
              version_range: null,
              origin: "cross_repo",
              owner: "acme",
              repo: "g",
            },
          ],
        ],
      ],
    );
    expect(checkInversions(r)).toEqual([]);
  });
});
