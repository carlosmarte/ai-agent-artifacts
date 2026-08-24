import { describe, it, expect } from "vitest";
import { hitRate } from "../src/optimize/score.mjs";

const queries = {
  positive: ["validate the frontmatter", "scaffold the skill", "audit the dependencies"],
  negative: ["format this csv file", "deploy to staging", "rotate the api keys"],
};

describe("hitRate", () => {
  it("returns 100% positive when description contains all positive content words", () => {
    const r = hitRate(
      "Validate the frontmatter, scaffold the skill, audit the dependencies.",
      queries,
    );
    expect(r.positive_hits).toBe(3);
    expect(r.false_positives).toBe(0);
    expect(r.score).toBe(100);
  });
  it("returns 0 false positives when description avoids negative vocabulary", () => {
    const r = hitRate("Score the description.", queries);
    expect(r.false_positives).toBe(0);
  });
  it("penalizes overlap with negatives", () => {
    const r = hitRate("Format this csv and deploy to staging.", queries);
    expect(r.false_positives).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(0);
  });
  it("score is clamped 0..100", () => {
    const r = hitRate("", queries);
    expect(r.score).toBe(0);
  });
});
