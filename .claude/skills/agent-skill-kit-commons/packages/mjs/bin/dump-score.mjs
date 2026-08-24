#!/usr/bin/env node
// dump-score <descriptions.json> — emits canonical JSON of scoreDescription per case.
import { readFileSync } from "node:fs";
import { scoreDescription } from "../src/lint/scorer.mjs";

const path = process.argv[2];
if (!path) {
  process.stderr.write("usage: dump-score <descriptions.json>\n");
  process.exit(64);
}
const cases = JSON.parse(readFileSync(path, "utf8"));
const out = {};
for (const c of cases) {
  const { score, breakdown } = scoreDescription(c.description, c.body);
  out[c.id] = { score, breakdown };
}
process.stdout.write(JSON.stringify(sortKeys(out), null, 2) + "\n");

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = sortKeys(v[k]);
    return o;
  }
  return v;
}
