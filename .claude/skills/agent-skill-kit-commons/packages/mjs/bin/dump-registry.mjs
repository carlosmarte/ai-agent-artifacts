#!/usr/bin/env node
import { basename } from "node:path";
import { buildRegistry } from "../src/registry.mjs";

const root = process.argv[2];
if (!root) {
  process.stderr.write("usage: dump-registry <root>\n");
  process.exit(64);
}
const reg = buildRegistry(root);
const nodes = {};
for (const [k, v] of reg.nodes) {
  nodes[k] = {
    name: v.name ?? k,
    dir_basename: v.dir ? basename(v.dir) : null,
    parse_error: v.parse_error ?? null,
    tier: v.tier ?? null,
  };
}
const edges = {};
for (const [k, deps] of reg.edges) {
  edges[k] = (deps ?? []).map((d) => ({
    name: d.name,
    version_range: d.version_range ?? null,
    origin: d.origin,
    owner: d.owner ?? null,
    repo: d.repo ?? null,
  }));
}
const out = sortKeys({ nodes, edges, warnings: reg.warnings });
process.stdout.write(JSON.stringify(out) + "\n");

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = sortKeys(v[k]);
    return o;
  }
  return v;
}
