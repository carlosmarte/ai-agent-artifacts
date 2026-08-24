import { makeIssue } from "../types.mjs";

export const NAMING_RULES = [
  {
    code: "E000_NAME_MISSING",
    severity: "error",
    field: "name",
    message: "name is required",
    check: (p) => !p.name,
  },
  {
    code: "E001_NAME_TOO_LONG",
    severity: "error",
    field: "name",
    message: "name must be 1-64 chars",
    check: (p) => !!p.name && p.name.length > 64,
  },
  {
    code: "E002_NAME_BAD_CHAR",
    severity: "error",
    field: "name",
    message: "name must use only [a-z0-9-]",
    check: (p) => !!p.name && !/^[a-z0-9-]+$/.test(p.name),
  },
  {
    code: "E003_NAME_HYPHEN_EDGE",
    severity: "error",
    field: "name",
    message: "name cannot start or end with '-'",
    check: (p) => !!p.name && (/^-/.test(p.name) || /-$/.test(p.name)),
  },
  {
    code: "E004_NAME_CONSECUTIVE_HYPHENS",
    severity: "error",
    field: "name",
    message: "name cannot contain '--'",
    check: (p) => !!p.name && /--/.test(p.name),
  },
  {
    code: "E005_NAME_DIRECTORY_MISMATCH",
    severity: "error",
    field: "name",
    message: "name must equal parent directory name",
    check: (p, dir) => !!p.name && !!dir && p.name !== dir,
  },
  {
    code: "E006_TIER_MISSING",
    severity: "error",
    field: "tier",
    message: "tier is required",
    check: (p) => !p.tier,
  },
  {
    code: "E007_TIER_INVALID",
    severity: "error",
    field: "tier",
    message: "tier must be one of org|team|app|project",
    check: (p, _dir, opts) =>
      !!p.tier && !opts.allowedTiers.includes(p.tier),
  },
  {
    code: "E008_DESCRIPTION_MISSING",
    severity: "error",
    field: "description",
    message: "description is required",
    check: (p) => !p.description,
  },
  {
    code: "E012_DESCRIPTION_TOO_LONG",
    severity: "error",
    field: "description",
    message: "description must be 1-1024 chars",
    check: (p) => !!p.description && p.description.length > 1024,
  },
  {
    code: "E009_DESCRIPTION_TOO_SHORT",
    severity: "warn",
    field: "description",
    message: "description < 60 chars; may not trigger reliably",
    check: (p) => !!p.description && p.description.length < 60,
  },
];

const DEFAULT_TIERS = ["org", "team", "app", "project"];

export function checkNaming(parsed, dirName, opts = {}) {
  const extraTiers = opts.extraTiers ?? [];
  const allowedTiers = opts.allowedTiers ?? [...DEFAULT_TIERS, ...extraTiers];
  const merged = { allowedTiers };
  const issues = [];
  for (const r of NAMING_RULES) {
    if (r.check(parsed, dirName, merged)) {
      issues.push(makeIssue(r.code, r.severity, r.field, r.message));
    }
  }
  return issues;
}
