import { describe, it, expect } from "vitest";
import { scoreDescription, loadAssets } from "../src/lint/scorer.mjs";

describe("loadAssets", () => {
  it("returns three populated collections", () => {
    const a = loadAssets();
    expect(a.vague.length).toBeGreaterThanOrEqual(30);
    expect(a.verbs.size).toBeGreaterThanOrEqual(50);
    expect(a.stop.size).toBeGreaterThanOrEqual(100);
  });

  it("is memoized (returns same object)", () => {
    const a = loadAssets();
    const b = loadAssets();
    expect(a).toBe(b);
  });
});

describe("scoreDescription — baselines", () => {
  it("low-quality vague description scores below 30", () => {
    const r = scoreDescription("A useful tool that helps with stuff.", "");
    expect(r.score).toBeLessThan(30);
  });

  it("high-quality description scores well", () => {
    const r = scoreDescription(
      "Validate a SKILL.md frontmatter against the agentskills.io spec. Use when the user asks to lint, check, or validate a skill before committing.",
      "Validate SKILL.md frontmatter against the agentskills.io spec. Lint a skill before committing.",
    );
    expect(r.score).toBeGreaterThanOrEqual(60);
  });

  it("returns the documented shape", () => {
    const r = scoreDescription("hello", "world");
    expect(r).toHaveProperty("score");
    expect(r).toHaveProperty("breakdown.keywordDensity");
    expect(r).toHaveProperty("breakdown.actionVerbs");
    expect(r).toHaveProperty("breakdown.triggerPhrases");
    expect(r).toHaveProperty("breakdown.specificity");
    expect(r).toHaveProperty("breakdown.length");
    expect(Array.isArray(r.warnings)).toBe(true);
  });
});

describe("scoreDescription — sub-scores in isolation", () => {
  it("action-verb first-token earns 12 + 8 = 20", () => {
    const r = scoreDescription("validate a thing", "");
    expect(r.breakdown.actionVerbs).toBe(20);
  });

  it("action-verb any-position-only earns 8", () => {
    const r = scoreDescription("the team will validate this thing", "");
    expect(r.breakdown.actionVerbs).toBe(8);
  });

  it("no action verb earns 0 and warns", () => {
    const r = scoreDescription("the thing exists here", "");
    expect(r.breakdown.actionVerbs).toBe(0);
    expect(
      r.warnings.some((w) => w.includes("does not lead with an action verb")),
    ).toBe(true);
  });

  it("trigger phrase 'use when' earns 20", () => {
    const r = scoreDescription("Do a thing. Use when X happens.", "");
    expect(r.breakdown.triggerPhrases).toBe(20);
  });

  it("trigger phrase 'when ' earns 20", () => {
    const r = scoreDescription("Do a thing when something happens", "");
    expect(r.breakdown.triggerPhrases).toBe(20);
  });

  it("no trigger phrase earns 0 and warns", () => {
    const r = scoreDescription("Do a thing.", "");
    expect(r.breakdown.triggerPhrases).toBe(0);
    expect(
      r.warnings.some((w) => w.includes("lacks a trigger phrase")),
    ).toBe(true);
  });

  it("vague phrase 'helps with' subtracts 5 from specificity", () => {
    const r = scoreDescription("A skill that helps with things", "");
    expect(r.breakdown.specificity).toBe(15);
    expect(r.warnings.some((w) => w.includes("vague phrases"))).toBe(true);
  });

  it("multiple vague phrases stack penalty", () => {
    const r = scoreDescription(
      "Helps with stuff and assists with general purpose tasks",
      "",
    );
    expect(r.breakdown.specificity).toBeLessThanOrEqual(5);
  });

  it("length below sweet-spot ramps linearly", () => {
    const r = scoreDescription("a".repeat(30), "");
    expect(r.breakdown.length).toBe(8); // 30/60 * 15 = 7.5 → 8
  });

  it("length above sweet-spot decays", () => {
    const r = scoreDescription("a".repeat(400), "");
    expect(r.breakdown.length).toBe(13); // 15 - (400-300)/50 = 13
  });

  it("length in sweet spot scores 15", () => {
    const r = scoreDescription("a".repeat(150), "");
    expect(r.breakdown.length).toBe(15);
  });

  it("keyword density rewards body overlap", () => {
    const r = scoreDescription(
      "validate skill frontmatter",
      "validate skill frontmatter against spec",
    );
    expect(r.breakdown.keywordDensity).toBe(25);
  });

  it("keyword density 0 when body shares no tokens", () => {
    const r = scoreDescription("validate skill", "completely unrelated text");
    expect(r.breakdown.keywordDensity).toBe(0);
  });

  it("score is clamped to 100", () => {
    const r = scoreDescription(
      "Validate a SKILL.md frontmatter against the agentskills.io spec. Use when the user asks to lint, check, or validate a skill before committing.",
      "validate skill frontmatter agentskills spec lint check before committing user asks",
    );
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
