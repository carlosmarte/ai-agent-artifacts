import { readFileSync, statSync, readdirSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import {
  parseFrontmatter,
  MissingFrontmatterError,
  MalformedFrontmatterError,
} from "../../parser.mjs";
import { checkNaming } from "../../rules/naming.mjs";
import { checkBody } from "../../rules/body.mjs";
import { checkReferences } from "../../rules/references.mjs";
import { checkOptionalDirs } from "../../rules/optional_dirs.mjs";
import { makeIssue } from "../../types.mjs";
import { formatHuman, formatJson } from "../format.mjs";

function discoverSkills(target) {
  const st = statSync(target);
  if (st.isFile()) {
    if (basename(target) === "SKILL.md") return [resolve(target, "..")];
    return [];
  }
  if (basename(target).toLowerCase() === "skill.md") return [resolve(target, "..")];
  // Directory: either it directly contains SKILL.md, or recurse one level.
  const direct = join(target, "SKILL.md");
  try {
    if (statSync(direct).isFile()) return [target];
  } catch {
    /* fall through */
  }
  const out = [];
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;
    out.push(...discoverSkills(join(target, entry.name)));
  }
  return out;
}

function validateOne(skillDir, opts) {
  const issues = [];
  const skillPath = join(skillDir, "SKILL.md");
  let text;
  try {
    text = readFileSync(skillPath, "utf8");
  } catch (e) {
    issues.push(
      makeIssue(
        "E100_SKILL_MD_MISSING",
        "error",
        "skill",
        `SKILL.md not readable: ${e.message}`,
      ),
    );
    return buildReport(skillPath, issues);
  }
  let parsed;
  try {
    parsed = parseFrontmatter(text);
  } catch (e) {
    if (e instanceof MissingFrontmatterError) {
      issues.push(
        makeIssue("E101_FRONTMATTER_MISSING", "error", "frontmatter", e.message),
      );
    } else if (e instanceof MalformedFrontmatterError) {
      issues.push(
        makeIssue(
          "E102_FRONTMATTER_MALFORMED",
          "error",
          "frontmatter",
          e.message,
        ),
      );
    } else {
      throw e;
    }
    return buildReport(skillPath, issues);
  }
  const dirName = basename(skillDir);
  issues.push(
    ...checkNaming(parsed, dirName, { extraTiers: opts.extraTiers }),
  );
  issues.push(...checkBody(parsed));
  issues.push(...checkReferences(parsed, skillDir));
  issues.push(...checkOptionalDirs(skillDir));
  return buildReport(skillPath, issues);
}

function buildReport(path, issues) {
  let errors = 0;
  let warnings = 0;
  for (const i of issues) {
    if (i.severity === "error") errors++;
    else warnings++;
  }
  const status = errors > 0 ? "FAIL" : warnings > 0 ? "WARN" : "PASS";
  return { path, status, issues, summary: { errors, warnings } };
}

function parseArgs(args) {
  const opts = {
    path: null,
    format: "human",
    noColor: false,
    strict: false,
    extraTiers: [],
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--format") opts.format = args[++i];
    else if (a === "--no-color") opts.noColor = true;
    else if (a === "--strict") opts.strict = true;
    else if (a === "--extra-tiers")
      opts.extraTiers = (args[++i] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    else if (!a.startsWith("--") && opts.path == null) opts.path = a;
  }
  return opts;
}

export async function validate(args) {
  const opts = parseArgs(args);
  if (!opts.path) {
    return {
      exitCode: 64,
      output: "usage: skills-ref validate <path> [--format json|human]\n",
    };
  }
  const skills = discoverSkills(resolve(opts.path));
  if (skills.length === 0) {
    return {
      exitCode: 1,
      output: `no SKILL.md found under: ${opts.path}\n`,
    };
  }
  const reports = skills.map((d) => validateOne(d, opts));
  let exitCode = 0;
  let totalErrors = 0;
  let totalWarnings = 0;
  for (const r of reports) {
    totalErrors += r.summary.errors;
    totalWarnings += r.summary.warnings;
  }
  if (totalErrors > 0) exitCode = 1;
  else if (opts.strict && totalWarnings > 0) exitCode = 2;
  let output;
  if (opts.format === "json") {
    if (reports.length === 1) output = formatJson(reports[0]);
    else
      output = formatJson({
        status:
          totalErrors > 0 ? "FAIL" : totalWarnings > 0 ? "WARN" : "PASS",
        reports,
        summary: { errors: totalErrors, warnings: totalWarnings },
      });
  } else {
    output = reports
      .map((r) => formatHuman(r, { color: !opts.noColor }))
      .join("");
  }
  return { exitCode, output };
}
