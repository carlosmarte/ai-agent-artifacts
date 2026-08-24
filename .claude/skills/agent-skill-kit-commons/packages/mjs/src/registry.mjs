import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "./parser.mjs";

/**
 * @typedef {object} Registry
 * @property {Map<string, object>} nodes - skill name -> { ...parsed, dir }
 * @property {Map<string, object[]>} edges - skill name -> array of dep refs
 * @property {string[]} warnings - human-readable advisories (e.g., name collisions)
 */

/**
 * Walk a root directory looking for `SKILL.md` files at depth <= maxDepth.
 * Parse each. Return a deterministic registry keyed by `name` (or directory
 * basename when parse_error). Skills that fail to parse are recorded with
 * `parse_error` and excluded from `edges`.
 */
export function buildRegistry(rootDir, { maxDepth = 3 } = {}) {
  const nodes = new Map();
  const edges = new Map();
  const warnings = [];
  walk(rootDir, 0, maxDepth, nodes, edges, warnings);
  return {
    nodes: new Map([...nodes.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
    edges: new Map([...edges.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
    warnings,
  };
}

function walk(dir, depth, maxDepth, nodes, edges, warnings) {
  if (depth > maxDepth) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;
    const sub = join(dir, entry.name);
    const skillFile = join(sub, "SKILL.md");
    let hasSkill = false;
    try {
      hasSkill = statSync(skillFile).isFile();
    } catch {
      hasSkill = false;
    }
    if (hasSkill) {
      let parsed;
      try {
        parsed = parseFrontmatter(readFileSync(skillFile, "utf8"));
      } catch (err) {
        const key = entry.name;
        if (nodes.has(key)) {
          warnings.push(`name collision on '${key}'; last entry wins`);
        }
        nodes.set(key, { name: key, dir: sub, parse_error: String(err.message ?? err) });
        continue; // do not recurse into a skill dir
      }
      const key = parsed.name ?? entry.name;
      if (nodes.has(key)) {
        warnings.push(`name collision on '${key}'; last entry wins`);
      }
      nodes.set(key, { ...parsed, dir: sub });
      edges.set(key, parsed.dependencies ?? []);
      continue; // do not recurse into a skill dir
    }
    walk(sub, depth + 1, maxDepth, nodes, edges, warnings);
  }
}
