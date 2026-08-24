import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseFrontmatter } from "../parser.mjs";
import { buildRegistry } from "../registry.mjs";

export const PROPERTY_FIELDS = [
  "name",
  "description",
  "tier",
  "license",
  "compatibility",
  "metadata",
  "allowed_tools",
  "dependencies",
];

function depToPlain(d) {
  return {
    name: d.name ?? null,
    origin: d.origin ?? null,
    owner: d.owner ?? null,
    repo: d.repo ?? null,
    version_range: d.version_range ?? null,
  };
}

function plainize(field, value) {
  if (field === "dependencies" && Array.isArray(value)) {
    return value.map(depToPlain);
  }
  return value;
}

export function readProperties(skillDir) {
  const absSkillDir = resolve(skillDir);
  const skillPath = join(absSkillDir, "SKILL.md");
  const text = readFileSync(skillPath, "utf8");
  const parsed = parseFrontmatter(text);
  const out = { _path: skillPath };
  for (const f of PROPERTY_FIELDS) {
    const v = parsed[f];
    out[f] = v == null ? null : plainize(f, v);
  }
  return out;
}

export function readPropertiesRoot(rootDir) {
  const root = resolve(rootDir);
  const st = statSync(root);
  if (!st.isDirectory()) {
    throw new Error(`not a directory: ${rootDir}`);
  }
  const reg = buildRegistry(root);
  const out = [];
  for (const [, node] of reg.nodes) {
    if (node.parse_error) continue;
    out.push(readProperties(node.dir));
  }
  out.sort((a, b) => {
    const an = a.name ?? "";
    const bn = b.name ?? "";
    return an < bn ? -1 : an > bn ? 1 : 0;
  });
  return out;
}
