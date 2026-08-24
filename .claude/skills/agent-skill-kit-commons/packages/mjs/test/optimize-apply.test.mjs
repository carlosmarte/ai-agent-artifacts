import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyVariant, commit, rollback, findDescriptionLine } from "../src/optimize/apply.mjs";

let tmp;
const original = [
  "---",
  "name: tmp-skill",
  "description: original description that is somewhat long and likely to trigger naming rule pass.",
  "tier: org",
  "---",
  "",
  "# tmp-skill",
  "",
  "Body content.",
  "",
].join("\n");

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "opt-apply-"));
  writeFileSync(join(tmp, "SKILL.md"), original, "utf8");
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("findDescriptionLine", () => {
  it("finds the description line within the first frontmatter block", () => {
    const lines = original.split("\n");
    const idx = findDescriptionLine(lines);
    expect(idx).toBe(2);
  });
  it("returns -1 when no frontmatter or no description", () => {
    expect(findDescriptionLine(["", "no frontmatter"])).toBe(-1);
  });
});

describe("applyVariant", () => {
  it("replaces description: line and preserves every other line byte-for-byte", () => {
    const { backup } = applyVariant(tmp, { text: "new description here" });
    const post = readFileSync(join(tmp, "SKILL.md"), "utf8").split("\n");
    const pre = original.split("\n");
    expect(post[2]).toBe("description: new description here");
    for (let i = 0; i < pre.length; i++) {
      if (i === 2) continue;
      expect(post[i]).toBe(pre[i]);
    }
    expect(existsSync(backup)).toBe(true);
  });
  it("commit() deletes the backup file", () => {
    const { backup } = applyVariant(tmp, { text: "new description here" });
    commit(backup);
    expect(existsSync(backup)).toBe(false);
  });
  it("rollback() restores the original and deletes the backup", () => {
    const { backup } = applyVariant(tmp, { text: "ought to be reverted" });
    const restored = rollback(tmp, backup);
    expect(restored).toBe(true);
    expect(readFileSync(join(tmp, "SKILL.md"), "utf8")).toBe(original);
    expect(existsSync(backup)).toBe(false);
  });
});
