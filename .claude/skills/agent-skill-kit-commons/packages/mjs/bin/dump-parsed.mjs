#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter, toCanonicalJson } from "../src/parser.mjs";

function parseArgs(argv) {
  const opts = { fixture: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--fixture") opts.fixture = argv[++i];
  }
  return opts;
}

const { fixture } = parseArgs(process.argv.slice(2));
if (!fixture) {
  process.stderr.write("usage: dump-parsed --fixture <path>\n");
  process.exit(64);
}
const skillPath = fixture.endsWith("SKILL.md") ? fixture : join(fixture, "SKILL.md");
const text = readFileSync(skillPath, "utf8");
const parsed = parseFrontmatter(text);
// Body length only — exclude full body so snapshots stay small.
// raw_frontmatter is intentionally excluded — its value normalization differs across yaml libs.
// eslint-disable-next-line no-unused-vars
const { body, raw_frontmatter: _rf, ...rest } = parsed;
const out = { ...rest, body_lines: body.split("\n").length };
process.stdout.write(toCanonicalJson(out) + "\n");
