import { describe, it, expect } from "vitest";
import { checkNaming, NAMING_RULES } from "../src/rules/naming.mjs";

function p(over = {}) {
  return {
    name: "org-clean",
    description:
      "A long enough description (well over the 60-char floor) to keep the description-too-short warn from firing.",
    tier: "org",
    license: null,
    compatibility: null,
    metadata: {},
    allowed_tools: [],
    dependencies: [],
    body: "hello",
    source_offset: 0,
    ...over,
  };
}

describe("checkNaming", () => {
  it("baseline produces no issues", () => {
    expect(checkNaming(p(), "org-clean")).toEqual([]);
  });

  it("E001_NAME_TOO_LONG fires for >64 chars", () => {
    const tooLong = "org-" + "a".repeat(80);
    const issues = checkNaming(p({ name: tooLong }), tooLong);
    expect(issues.some((i) => i.code === "E001_NAME_TOO_LONG")).toBe(true);
  });

  it("E002_NAME_BAD_CHAR fires on uppercase", () => {
    const issues = checkNaming(p({ name: "org-Bad" }), "org-Bad");
    expect(issues.some((i) => i.code === "E002_NAME_BAD_CHAR")).toBe(true);
  });

  it("E003_NAME_HYPHEN_EDGE fires on leading dash", () => {
    const issues = checkNaming(p({ name: "-org-x" }), "-org-x");
    expect(issues.some((i) => i.code === "E003_NAME_HYPHEN_EDGE")).toBe(true);
  });

  it("E004_NAME_CONSECUTIVE_HYPHENS fires on '--'", () => {
    const issues = checkNaming(p({ name: "org--x" }), "org--x");
    expect(issues.some((i) => i.code === "E004_NAME_CONSECUTIVE_HYPHENS")).toBe(
      true,
    );
  });

  it("E005_NAME_DIRECTORY_MISMATCH fires when name != dir", () => {
    const issues = checkNaming(p(), "different-dir");
    expect(issues.some((i) => i.code === "E005_NAME_DIRECTORY_MISMATCH")).toBe(
      true,
    );
  });

  it("E006_TIER_MISSING fires on missing tier", () => {
    const issues = checkNaming(p({ tier: null }), "org-clean");
    expect(issues.some((i) => i.code === "E006_TIER_MISSING")).toBe(true);
  });

  it("E007_TIER_INVALID fires on unknown tier", () => {
    const issues = checkNaming(p({ tier: "wildcat" }), "org-clean");
    expect(issues.some((i) => i.code === "E007_TIER_INVALID")).toBe(true);
  });

  it("extraTiers suppresses E007 for governance tier", () => {
    const issues = checkNaming(p({ tier: "company" }), "org-clean", {
      extraTiers: ["company"],
    });
    expect(issues.some((i) => i.code === "E007_TIER_INVALID")).toBe(false);
  });

  it("E012_DESCRIPTION_TOO_LONG fires above 1024 chars", () => {
    const issues = checkNaming(
      p({ description: "a".repeat(1100) }),
      "org-clean",
    );
    expect(issues.some((i) => i.code === "E012_DESCRIPTION_TOO_LONG")).toBe(
      true,
    );
  });

  it("E009_DESCRIPTION_TOO_SHORT is a warn", () => {
    const issues = checkNaming(p({ description: "short" }), "org-clean");
    const w = issues.find((i) => i.code === "E009_DESCRIPTION_TOO_SHORT");
    expect(w?.severity).toBe("warn");
  });

  it("rule table is exported and non-empty", () => {
    expect(NAMING_RULES.length).toBeGreaterThanOrEqual(11);
  });

  it("rule code numeric prefixes are unique (E012 split from former E008)", () => {
    const prefixes = NAMING_RULES.map((r) => r.code.split("_")[0]);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });
});
