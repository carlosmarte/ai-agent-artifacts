import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildRegistry } from "../src/registry.mjs";
import { auditFrontmatter } from "../src/audit/frontmatter.mjs";
import { auditScripts } from "../src/audit/scripts.mjs";
import { auditDepOrigins } from "../src/audit/deps_origin.mjs";
import { auditPathLeak } from "../src/audit/path_leak.mjs";
import { formatAudit } from "../src/audit/printer.mjs";

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "audit-test-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function mkSkill(name, frontmatterText, body = "body content") {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), `---\n${frontmatterText}\n---\n${body}\n`);
  return dir;
}

describe("auditFrontmatter", () => {
  it("flags unauthorized top-level fields", () => {
    mkSkill(
      "org-bad",
      "name: org-bad\ndescription: D\ntier: org\nclaude-priority: high",
    );
    const reg = buildRegistry(root);
    const f = auditFrontmatter(reg);
    expect(f).toHaveLength(1);
    expect(f[0].code).toBe("A001_UNAUTHORIZED_FIELD");
    expect(f[0].severity).toBe("MEDIUM");
    expect(f[0].where).toMatch(/:claude-priority$/);
  });

  it("does not flag allowed fields", () => {
    mkSkill("org-good", "name: org-good\ndescription: D\ntier: org\nlicense: Apache-2.0");
    expect(auditFrontmatter(buildRegistry(root))).toEqual([]);
  });
});

describe("auditScripts", () => {
  it("flags subprocess(...,shell=True) as HIGH", () => {
    const dir = mkSkill("org-scripts", "name: org-scripts\ndescription: D\ntier: org");
    mkdirSync(join(dir, "scripts"), { recursive: true });
    writeFileSync(
      join(dir, "scripts", "inject.py"),
      'import subprocess\nsubprocess.run(cmd, shell=True)\n',
    );
    const f = auditScripts(buildRegistry(root));
    const sp = f.filter((x) => x.message.includes("subprocess-shell"));
    expect(sp).toHaveLength(1);
    expect(sp[0].severity).toBe("HIGH");
    expect(sp[0].where).toMatch(/inject\.py:2$/);
  });

  it("does not flag safe-only scripts", () => {
    const dir = mkSkill("org-clean", "name: org-clean\ndescription: D\ntier: org");
    mkdirSync(join(dir, "scripts"), { recursive: true });
    writeFileSync(
      join(dir, "scripts", "safe.py"),
      "import subprocess\nsubprocess.run(['ls'])\n",
    );
    expect(auditScripts(buildRegistry(root))).toEqual([]);
  });
});

describe("auditDepOrigins", () => {
  it("MEDIUM when no allowlist", () => {
    mkSkill(
      "org-a",
      "name: org-a\ndescription: D\ntier: org\ndependencies:\n  - acme/governance#security-baseline",
    );
    const f = auditDepOrigins(buildRegistry(root), {});
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe("MEDIUM");
    expect(f[0].code).toBe("A020_UNVETTED_ORIGIN");
  });

  it("zero when owner is in allowlist", () => {
    mkSkill(
      "org-a",
      "name: org-a\ndescription: D\ntier: org\ndependencies:\n  - acme/governance#security-baseline",
    );
    expect(auditDepOrigins(buildRegistry(root), { allowedOrigins: ["acme"] })).toEqual([]);
  });

  it("HIGH when allowlist set but owner not present", () => {
    mkSkill(
      "org-a",
      "name: org-a\ndescription: D\ntier: org\ndependencies:\n  - acme/governance#security-baseline",
    );
    const f = auditDepOrigins(buildRegistry(root), { allowedOrigins: ["other"] });
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe("HIGH");
  });
});

describe("auditPathLeak", () => {
  it("flags /Users/ in body", () => {
    mkSkill(
      "org-leaky",
      "name: org-leaky\ndescription: D\ntier: org",
      "this path /Users/foo/bar leaks the layout.",
    );
    const f = auditPathLeak(buildRegistry(root));
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe("MEDIUM");
    expect(f[0].code).toBe("A030_HOST_PATH_LEAK");
  });

  it("ignores fenced text/console/bash blocks", () => {
    mkSkill(
      "org-doc",
      "name: org-doc\ndescription: D\ntier: org",
      "Run this:\n\n```bash\nls /Users/foo/bar\n```\n",
    );
    expect(auditPathLeak(buildRegistry(root))).toEqual([]);
  });

  it("ignores blockquote lines", () => {
    mkSkill(
      "org-quote",
      "name: org-quote\ndescription: D\ntier: org",
      "> example: /Users/foo/bar in a quote",
    );
    expect(auditPathLeak(buildRegistry(root))).toEqual([]);
  });
});

describe("formatAudit", () => {
  it("emits HIGH then MEDIUM then LOW and a summary", () => {
    const out = formatAudit(
      [
        { severity: "MEDIUM", code: "X", where: "w1", message: "m1" },
        { severity: "HIGH", code: "Y", where: "w2", message: "m2" },
      ],
      "human",
    );
    expect(out).toMatch(/^\[HIGH\]/);
    expect(out).toContain("[MEDIUM]");
    expect(out).toMatch(/summary: 1 HIGH, 1 MEDIUM, 0 LOW/);
  });
});
