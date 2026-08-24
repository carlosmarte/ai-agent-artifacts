import { makeIssue } from "../types.mjs";

const ABS_PATH_RE = /(^|\s)(\/[A-Za-z][^\s)`'"]*)/g;

export function checkBody(parsed) {
  const issues = [];
  const body = parsed.body ?? "";
  if (!body.trim()) {
    issues.push(
      makeIssue("E011_BODY_MISSING", "error", "body", "body must not be empty"),
    );
  }
  const lines = body.split("\n").length;
  if (lines > 500) {
    issues.push(
      makeIssue(
        "W001_BODY_TOO_LONG",
        "warn",
        "body",
        `body has ${lines} lines (recommend <= 500)`,
      ),
    );
  }
  // Strip fenced code blocks AND inline `code` spans before scanning so
  // example absolute paths inside backticks are not flagged.
  const scrub = body
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]*`/g, "");
  for (const m of scrub.matchAll(ABS_PATH_RE)) {
    issues.push(
      makeIssue(
        "E010_ABSOLUTE_PATH_IN_BODY",
        "error",
        "body",
        `absolute path in body: ${m[2]}`,
        m.index,
      ),
    );
  }
  return issues;
}
