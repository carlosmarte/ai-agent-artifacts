import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { makeIssue } from "../types.mjs";

const LINK_RE = /\[[^\]]*\]\(([^)#?]+)(?:[?#][^)]*)?\)/g;

export function checkReferences(parsed, skillDir) {
  const issues = [];
  const body = parsed.body ?? "";
  for (const m of body.matchAll(LINK_RE)) {
    const target = m[1].trim();
    if (!target) continue;
    if (/^(https?:|mailto:|tel:|ftp:|#)/.test(target)) continue;
    if (target.startsWith("/")) continue; // absolute paths handled by checkBody (E010)
    const full = resolve(skillDir, target);
    try {
      if (!existsSync(full)) {
        issues.push(
          makeIssue(
            "W002_BROKEN_REFERENCE",
            "warn",
            "body",
            `broken reference: ${target}`,
          ),
        );
      } else {
        statSync(full);
      }
    } catch {
      issues.push(
        makeIssue(
          "W002_BROKEN_REFERENCE",
          "warn",
          "body",
          `broken reference: ${target}`,
        ),
      );
    }
  }
  return issues;
}
