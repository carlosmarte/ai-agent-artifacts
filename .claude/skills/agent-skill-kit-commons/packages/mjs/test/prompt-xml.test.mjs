import { describe, it, expect } from "vitest";
import { xmlEscape, serializeAvailableSkills } from "../src/prompt/xml.mjs";

describe("xmlEscape", () => {
  it("escapes the five mandatory characters", () => {
    expect(xmlEscape(`a & b < c > d " e ' f`)).toBe(
      "a &amp; b &lt; c &gt; d &quot; e &apos; f",
    );
  });

  it("returns empty string for null / undefined", () => {
    expect(xmlEscape(null)).toBe("");
    expect(xmlEscape(undefined)).toBe("");
  });

  it("leaves ordinary text unchanged", () => {
    expect(xmlEscape("plain ascii 123")).toBe("plain ascii 123");
  });
});

describe("serializeAvailableSkills", () => {
  it("emits empty container when entries is empty", () => {
    expect(serializeAvailableSkills({ entries: [] })).toBe(
      "<available_skills>\n</available_skills>\n",
    );
  });

  it("emits one <skill> child per entry, escaping description", () => {
    const out = serializeAvailableSkills({
      entries: [{ name: "x", tier: "org", description: "y < z" }],
    });
    expect(out).toBe(
      `<available_skills>\n  <skill name="x" tier="org">y &lt; z</skill>\n</available_skills>\n`,
    );
  });

  it("appends invalid='true' attribute when entry.invalid is set", () => {
    const out = serializeAvailableSkills({
      entries: [{ name: "x", tier: "org", description: "d", invalid: true }],
    });
    expect(out).toContain(`<skill name="x" tier="org" invalid="true">d</skill>`);
  });

  it("emits <truncated count='N'/> when truncated > 0", () => {
    const out = serializeAvailableSkills({
      entries: [{ name: "x", tier: "org", description: "d" }],
      truncated: 3,
    });
    expect(out).toContain(`  <truncated count="3"/>\n`);
  });

  it("escapes name and tier attributes as well", () => {
    const out = serializeAvailableSkills({
      entries: [{ name: 'q"u', tier: "o>r", description: "d" }],
    });
    expect(out).toContain(`name="q&quot;u"`);
    expect(out).toContain(`tier="o&gt;r"`);
  });
});
