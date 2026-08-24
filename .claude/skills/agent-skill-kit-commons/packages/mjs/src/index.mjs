export {
  parseFrontmatter,
  toCanonicalJson,
  MissingFrontmatterError,
  MalformedFrontmatterError,
} from "./parser.mjs";
export { checkNaming, NAMING_RULES } from "./rules/naming.mjs";
export { checkBody } from "./rules/body.mjs";
export { checkReferences } from "./rules/references.mjs";
export { checkOptionalDirs } from "./rules/optional_dirs.mjs";
export { buildRegistry } from "./registry.mjs";
export { topoSort, findMissingTargets } from "./deps/toposort.mjs";
export { TIER_RANK, checkInversions } from "./deps/inversion.mjs";
export { parseRange, intersects } from "./deps/range.mjs";
export { checkConflicts, checkUnpinned } from "./deps/conflict.mjs";
export { auditFrontmatter } from "./audit/frontmatter.mjs";
export { auditScripts } from "./audit/scripts.mjs";
export { auditDepOrigins } from "./audit/deps_origin.mjs";
export { auditPathLeak } from "./audit/path_leak.mjs";
export { formatAudit } from "./audit/printer.mjs";
export { dispatch } from "./cli/dispatch.mjs";
