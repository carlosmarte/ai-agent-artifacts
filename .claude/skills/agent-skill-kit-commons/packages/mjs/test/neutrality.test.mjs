import { describe, it, expect } from "vitest";
import { checkVendorNeutrality } from "../src/lint/neutrality.mjs";

function mk(rawFrontmatter) {
  return { raw_frontmatter: rawFrontmatter };
}

describe("checkVendorNeutrality", () => {
  it("flags claude-prefixed top-level field", () => {
    const issues = checkVendorNeutrality(
      mk({ name: "x", description: "y", tier: "org", "claude-priority": "high" }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("L001_VENDOR_SPECIFIC_FIELD");
    expect(issues[0].severity).toBe("warn");
    expect(issues[0].field).toBe("claude-priority");
    expect(issues[0].message).toMatch(/metadata/);
  });

  it("flags cursor- and devin- prefixes too", () => {
    const issues = checkVendorNeutrality(
      mk({ "cursor-mode": "fast", "devin-rate": 1 }),
    );
    expect(issues).toHaveLength(2);
    const codes = issues.map((i) => i.code);
    expect(codes.every((c) => c === "L001_VENDOR_SPECIFIC_FIELD")).toBe(true);
  });

  it("ignores allowed top-level fields", () => {
    const issues = checkVendorNeutrality(
      mk({
        name: "x",
        description: "y",
        tier: "org",
        license: "Apache-2.0",
        compatibility: "anything",
        metadata: { foo: 1 },
        "allowed-tools": ["Read"],
        dependencies: [],
      }),
    );
    expect(issues).toHaveLength(0);
  });

  it("does not flag non-vendor unauthorized fields", () => {
    const issues = checkVendorNeutrality(mk({ "myproject-internal": "foo" }));
    expect(issues).toHaveLength(0);
  });

  it("nested under metadata does not flag", () => {
    const issues = checkVendorNeutrality(
      mk({ metadata: { "claude-priority": "high" } }),
    );
    expect(issues).toHaveLength(0);
  });

  it("handles missing raw_frontmatter gracefully", () => {
    expect(checkVendorNeutrality({})).toEqual([]);
    expect(checkVendorNeutrality({ raw_frontmatter: null })).toEqual([]);
  });
});
