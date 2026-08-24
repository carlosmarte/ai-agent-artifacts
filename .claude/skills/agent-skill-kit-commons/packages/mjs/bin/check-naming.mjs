#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { parseFrontmatter } from "../src/parser.mjs";
import { checkNaming } from "../src/rules/naming.mjs";

function parseArgs(argv) {
  const opts = { fixture: null, extraTiers: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--fixture") opts.fixture = argv[++i];
    else if (argv[i] === "--extra-tiers")
      opts.extraTiers = (argv[++i] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  }
  return opts;
}

const { fixture, extraTiers } = parseArgs(process.argv.slice(2));
if (!fixture) {
  process.stderr.write("usage: check-naming --fixture <path>\n");
  process.exit(64);
}
const absDir = resolve(fixture);
const skillPath = join(absDir, "SKILL.md");
const text = readFileSync(skillPath, "utf8");
const parsed = parseFrontmatter(text);
const dirName = basename(absDir);
const issues = checkNaming(parsed, dirName, { extraTiers });
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
    return out;
  }
  return v;
}
process.stdout.write(JSON.stringify(sortKeys(issues)) + "\n");
