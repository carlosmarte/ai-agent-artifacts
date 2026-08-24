import { describe, it, expect } from "vitest";
import { checkBody } from "../src/rules/body.mjs";

function p(body) {
  return {
    name: "org-x",
    description: "x",
    tier: "org",
    license: null,
    compatibility: null,
    metadata: {},
    allowed_tools: [],
    dependencies: [],
    body,
    source_offset: 0,
  };
}

describe("checkBody", () => {
  it("clean short body has no issues", () => {
    expect(checkBody(p("hello world\nstill hello"))).toEqual([]);
  });

  it("empty body emits E011_BODY_MISSING", () => {
    const issues = checkBody(p(""));
    expect(issues.some((i) => i.code === "E011_BODY_MISSING")).toBe(true);
  });

  it("600-line body emits one W001_BODY_TOO_LONG", () => {
    const body = "line\n".repeat(600);
    const issues = checkBody(p(body));
    expect(issues.filter((i) => i.code === "W001_BODY_TOO_LONG")).toHaveLength(
      1,
    );
  });

  it("absolute path emits E010", () => {
    const issues = checkBody(p("see /Users/foo/bar for the script"));
    expect(issues.some((i) => i.code === "E010_ABSOLUTE_PATH_IN_BODY")).toBe(
      true,
    );
  });

  it("absolute path inside fenced code block is ignored", () => {
    const issues = checkBody(p("see code:\n```\n/Users/foo/bar\n```\n"));
    expect(issues.some((i) => i.code === "E010_ABSOLUTE_PATH_IN_BODY")).toBe(
      false,
    );
  });
});
