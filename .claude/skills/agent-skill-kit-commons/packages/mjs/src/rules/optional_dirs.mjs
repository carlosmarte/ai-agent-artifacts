import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { makeIssue } from "../types.mjs";

const OPTIONAL_DIRS = ["scripts", "references", "assets"];

export function checkOptionalDirs(skillDir) {
  const issues = [];
  for (const d of OPTIONAL_DIRS) {
    const p = join(skillDir, d);
    if (!existsSync(p)) continue;
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    const entries = readdirSync(p).filter((n) => !n.startsWith("."));
    if (entries.length === 0) {
      issues.push(
        makeIssue(
          "W003_EMPTY_OPTIONAL_DIR",
          "warn",
          d,
          `optional directory '${d}/' exists but is empty`,
        ),
      );
    }
  }
  return issues;
}
