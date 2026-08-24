// Shared type-shape documentation (JSDoc).
//
// @typedef {{
//   code: string,
//   severity: "error" | "warn",
//   field: string,
//   message: string,
//   source_offset: number | null
// }} Issue
//
// @typedef {{
//   name: string,
//   version_range: string | null,
//   origin: "in_repo" | "cross_repo",
//   owner: string | null,
//   repo: string | null
// }} DepRef
//
// @typedef {{
//   name: string | null,
//   description: string | null,
//   tier: string | null,
//   license: string | null,
//   compatibility: string | null,
//   metadata: Record<string,string>,
//   allowed_tools: string[],
//   dependencies: DepRef[],
//   body: string,
//   source_offset: number
// }} Parsed
//
// @typedef {{
//   path: string,
//   status: "PASS" | "FAIL" | "WARN",
//   issues: Issue[],
//   summary: { errors: number, warnings: number }
// }} Report

export function makeIssue(code, severity, field, message, source_offset = null) {
  return { code, severity, field, message, source_offset };
}
