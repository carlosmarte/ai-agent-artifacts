import { describe, it, expect } from "vitest";
import { generateDeterministic, extractVerbsAndNouns } from "../src/optimize/generate.mjs";

const parsed = {
  description: "Validate the frontmatter and audit the dependencies.",
  body: "scaffold the skill, validate the registry, audit the graph, score the description.",
};

describe("extractVerbsAndNouns", () => {
  it("pulls verbs from both body and description", () => {
    const { verbs } = extractVerbsAndNouns(parsed);
    expect(verbs).toContain("validate");
    expect(verbs).toContain("audit");
    expect(verbs).toContain("scaffold");
  });
  it("pulls nouns from description and body", () => {
    const { nouns } = extractVerbsAndNouns(parsed);
    expect(nouns).toContain("frontmatter");
    expect(nouns).toContain("dependencies");
    expect(nouns).toContain("registry");
  });
});

describe("generateDeterministic", () => {
  it("emits n positives and n negatives", () => {
    const { positive, negative } = generateDeterministic(parsed, 4);
    expect(positive).toHaveLength(4);
    expect(negative).toHaveLength(4);
  });
  it("output is byte-stable across runs (no random)", () => {
    const a = generateDeterministic(parsed, 4);
    const b = generateDeterministic(parsed, 4);
    expect(a).toEqual(b);
  });
  it("positive queries use the skill's verbs and nouns", () => {
    const { positive } = generateDeterministic(parsed, 4);
    expect(positive[0]).toMatch(/^(validate|scaffold|audit|score) the/);
  });
});
