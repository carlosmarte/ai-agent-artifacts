import { describe, it, expect } from "vitest";
import {
  parseFrontmatter,
  MissingFrontmatterError,
  MalformedFrontmatterError,
} from "../src/parser.mjs";

describe("parseFrontmatter", () => {
  it("parses the happy path", () => {
    const out = parseFrontmatter(
      "---\nname: org-x\ndescription: y\ntier: org\n---\nbody",
    );
    expect(out.name).toBe("org-x");
    expect(out.description).toBe("y");
    expect(out.tier).toBe("org");
    expect(out.body).toBe("body");
    expect(out.dependencies).toEqual([]);
  });

  it("throws MissingFrontmatterError when no opening ---", () => {
    expect(() => parseFrontmatter("hello world\n")).toThrow(
      MissingFrontmatterError,
    );
  });

  it("throws MissingFrontmatterError when no closing ---", () => {
    expect(() => parseFrontmatter("---\nname: x\nno-closer")).toThrow(
      MissingFrontmatterError,
    );
  });

  it("throws MalformedFrontmatterError on bad YAML", () => {
    expect(() =>
      parseFrontmatter("---\nname: : :\n---\nbody"),
    ).toThrow(MalformedFrontmatterError);
  });

  it("normalizes a pinned in-repo dependency", () => {
    const out = parseFrontmatter(
      "---\nname: org-a\ndescription: d\ntier: org\ndependencies:\n  - agent-creation@^1.0.0\n---\n",
    );
    expect(out.dependencies).toEqual([
      {
        name: "agent-creation",
        version_range: "^1.0.0",
        origin: "in_repo",
        owner: null,
        repo: null,
      },
    ]);
  });

  it("normalizes a cross-repo dependency", () => {
    const out = parseFrontmatter(
      "---\nname: org-a\ndescription: d\ntier: org\ndependencies:\n  - acme/governance#security-baseline@~2.1\n---\n",
    );
    expect(out.dependencies).toEqual([
      {
        name: "security-baseline",
        version_range: "~2.1",
        origin: "cross_repo",
        owner: "acme",
        repo: "governance",
      },
    ]);
  });

  it("returns empty body when only frontmatter is present", () => {
    const out = parseFrontmatter(
      "---\nname: org-a\ndescription: d\ntier: org\n---\n",
    );
    expect(out.body.trim()).toBe("");
  });
});
