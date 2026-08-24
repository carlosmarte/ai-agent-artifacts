#!/usr/bin/env node
import { buildRegistry } from "../src/registry.mjs";
import { topoSort, findMissingTargets } from "../src/deps/toposort.mjs";
import { checkInversions } from "../src/deps/inversion.mjs";
import { checkConflicts, checkUnpinned } from "../src/deps/conflict.mjs";

const root = process.argv[2];
if (!root) {
  process.stderr.write("usage: dump-deps <root>\n");
  process.exit(64);
}
const reg = buildRegistry(root);
const { order, cycles } = topoSort(reg);
const missing = findMissingTargets(reg);
const inversions = checkInversions(reg);
const conflicts = checkConflicts(reg);
const unpinned = checkUnpinned(reg);
const out = sortKeys({
  order,
  cycles,
  missing,
  inversions,
  conflicts,
  unpinned,
});
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
