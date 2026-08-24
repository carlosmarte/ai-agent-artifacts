import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildRegistry } from "../src/registry.mjs";

function makeSkill(root, name, frontmatter, body = "body content") {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => {
      if (Array.isArray(v)) {
        return `${k}:\n${v.map((x) => `  - ${x}`).join("\n")}`;
      }
      return `${k}: ${v}`;
    })
    .join("\n");
  writeFileSync(join(dir, "SKILL.md"), `---\n${fm}\n---\n${body}\n`);
  return dir;
}

describe("buildRegistry", () => {
  let root;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "registry-test-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("returns empty registry when root has no SKILL.md", () => {
    const reg = buildRegistry(root);
    expect([...reg.nodes.keys()]).toEqual([]);
    expect([...reg.edges.keys()]).toEqual([]);
  });

  it("registers one valid skill", () => {
    makeSkill(root, "org-alpha", {
      name: "org-alpha",
      description: "alpha desc",
      tier: "org",
    });
    const reg = buildRegistry(root);
    expect([...reg.nodes.keys()]).toEqual(["org-alpha"]);
    expect(reg.nodes.get("org-alpha").tier).toBe("org");
    expect(reg.edges.get("org-alpha")).toEqual([]);
  });

  it("records parse_error for an invalid skill alongside a valid one", () => {
    makeSkill(root, "org-good", {
      name: "org-good",
      description: "g",
      tier: "org",
    });
    // Invalid: malformed yaml
    const badDir = join(root, "org-bad");
    mkdirSync(badDir, { recursive: true });
    writeFileSync(join(badDir, "SKILL.md"), "---\nname: : :\n---\nbody\n");
    const reg = buildRegistry(root);
    expect([...reg.nodes.keys()].sort()).toEqual(["org-bad", "org-good"]);
    expect(reg.nodes.get("org-bad").parse_error).toBeTruthy();
    expect(reg.edges.has("org-bad")).toBe(false);
  });

  it("excludes deeply-nested skills beyond maxDepth", () => {
    const deep = join(root, "a", "b", "c", "d", "deep-skill");
    mkdirSync(deep, { recursive: true });
    writeFileSync(
      join(deep, "SKILL.md"),
      "---\nname: deep-skill\ndescription: d\ntier: org\n---\nbody\n",
    );
    const reg = buildRegistry(root, { maxDepth: 3 });
    expect([...reg.nodes.keys()]).toEqual([]);
  });

  it("records a warning on name collision and last entry wins", () => {
    // Two child dirs whose SKILL.md both declare name: same
    const a = join(root, "wrap-a");
    const b = join(root, "wrap-b");
    mkdirSync(a, { recursive: true });
    mkdirSync(b, { recursive: true });
    writeFileSync(
      join(a, "SKILL.md"),
      "---\nname: same-name\ndescription: A\ntier: org\n---\nA\n",
    );
    writeFileSync(
      join(b, "SKILL.md"),
      "---\nname: same-name\ndescription: B\ntier: org\n---\nB\n",
    );
    const reg = buildRegistry(root);
    expect([...reg.nodes.keys()]).toEqual(["same-name"]);
    expect(reg.nodes.get("same-name").description).toBe("B"); // last wins
    expect(reg.warnings.some((w) => w.includes("same-name"))).toBe(true);
  });

  it("does not recurse into a skill directory", () => {
    // Parent has SKILL.md; nested SKILL.md inside should be ignored.
    const outer = join(root, "outer");
    mkdirSync(outer, { recursive: true });
    writeFileSync(
      join(outer, "SKILL.md"),
      "---\nname: outer\ndescription: d\ntier: org\n---\nbody\n",
    );
    const inner = join(outer, "inner-skill");
    mkdirSync(inner, { recursive: true });
    writeFileSync(
      join(inner, "SKILL.md"),
      "---\nname: inner\ndescription: d\ntier: org\n---\nbody\n",
    );
    const reg = buildRegistry(root);
    expect([...reg.nodes.keys()]).toEqual(["outer"]);
  });
});
