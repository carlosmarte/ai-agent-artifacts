import { readFileSync, statSync, readdirSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import {
  parseFrontmatter,
  MissingFrontmatterError,
  MalformedFrontmatterError,
} from "../../parser.mjs";
import { lint } from "../../lint/index.mjs";

function discoverSkills(target) {
  const st = statSync(target);
  if (st.isFile()) {
    if (basename(target) === "SKILL.md") return [resolve(target, "..")];
    return [];
  }
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

function parseArgs(args) {
  const opts = {
    path: null,
    format: "human",
    explain: false,
    minScore: 40,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--format") opts.format = args[++i];
    else if (a === "--explain") opts.explain = true;
    else if (a === "--min-score") {
      const v = args[++i];
      const n = parseInt(v, 10);
      if (!Number.isNaN(n)) opts.minScore = n;
    } else if (!a.startsWith("--") && opts.path == null) opts.path = a;
  }
  return opts;
}

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = sortKeys(v[k]);
    return o;
  }
  return v;
}

function lintOne(skillDir) {
  const skillPath = join(skillDir, "SKILL.md");
  let text;
  try {
    text = readFileSync(skillPath, "utf8");
  } catch (e) {
    return {
      path: skillPath,
      score: 0,
      breakdown: {
        keywordDensity: 0,
        actionVerbs: 0,
        triggerPhrases: 0,
        specificity: 0,
        length: 0,
      },
      issues: [
        {
          code: "E100_SKILL_MD_MISSING",
          severity: "error",
          field: "skill",
          message: `SKILL.md not readable: ${e.message}`,
        },
      ],
    };
  }
  let parsed;
  try {
    parsed = parseFrontmatter(text);
  } catch (e) {
    const code =
      e instanceof MissingFrontmatterError
        ? "E101_FRONTMATTER_MISSING"
        : e instanceof MalformedFrontmatterError
          ? "E102_FRONTMATTER_MALFORMED"
          : "E102_FRONTMATTER_MALFORMED";
    return {
      path: skillPath,
      score: 0,
      breakdown: {
        keywordDensity: 0,
        actionVerbs: 0,
        triggerPhrases: 0,
        specificity: 0,
        length: 0,
      },
      issues: [
        { code, severity: "error", field: "frontmatter", message: e.message },
      ],
    };
  }
  const r = lint(parsed, skillDir);
  return { path: skillPath, ...r };
}

function exitCodeFor(report, minScore) {
  if (report.issues.some((i) => i.severity === "error")) return 1;
  if (report.issues.some((i) => i.code === "W002_BROKEN_REFERENCE")) return 1;
  if (report.score < minScore) return 1;
  return 0;
}

function formatHuman(report, opts) {
  const lines = [];
  const status = exitCodeFor(report, opts.minScore) === 0 ? "OK" : "FAIL";
  lines.push(`${report.path}`);
  lines.push(`  discoverability: ${report.score}/100 [${status}]`);
  if (opts.explain) {
    const b = report.breakdown;
    lines.push(
      `  sub-scores: keyword=${b.keywordDensity}/25 verbs=${b.actionVerbs}/20 trigger=${b.triggerPhrases}/20 specificity=${b.specificity}/20 length=${b.length}/15`,
    );
  }
  for (const i of report.issues) {
    lines.push(`  [${i.severity}] ${i.code}: ${i.message}`);
  }
  return lines.join("\n") + "\n";
}

export async function lintVerb(args) {
  const opts = parseArgs(args);
  if (!opts.path) {
    return {
      exitCode: 64,
      output:
        "usage: skills-ref lint <path> [--format json|human] [--explain] [--min-score N]\n",
    };
  }
  const skills = discoverSkills(resolve(opts.path));
  if (skills.length === 0) {
    return { exitCode: 1, output: `no SKILL.md found under: ${opts.path}\n` };
  }
  const reports = skills.map(lintOne);
  let exitCode = 0;
  for (const r of reports) {
    if (exitCodeFor(r, opts.minScore) === 1) exitCode = 1;
  }
  let output;
  if (opts.format === "json") {
    const payload =
      reports.length === 1
        ? sortKeys({
            score: reports[0].score,
            breakdown: reports[0].breakdown,
            issues: reports[0].issues,
            path: reports[0].path,
          })
        : sortKeys({
            reports: reports.map((r) => ({
              path: r.path,
              score: r.score,
              breakdown: r.breakdown,
              issues: r.issues,
            })),
          });
    output = JSON.stringify(payload) + "\n";
  } else {
    output = reports.map((r) => formatHuman(r, opts)).join("");
  }
  return { exitCode, output };
}
