import { statSync } from "node:fs";
import { resolve, join } from "node:path";
import { optimize } from "../../optimize/index.mjs";
import { applyVariant, commit, rollback } from "../../optimize/apply.mjs";
import { validate } from "./validate.mjs";

function parseArgs(args) {
  const opts = {
    path: null,
    format: "human",
    baselineOnly: false,
    apply: null,
    queryCount: 8,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--baseline-only") opts.baselineOnly = true;
    else if (a === "--apply") {
      const v = args[++i];
      const n = parseInt(v, 10);
      if (!Number.isNaN(n)) opts.apply = n;
    } else if (a === "--format") opts.format = args[++i];
    else if (a === "--query-count") {
      const v = args[++i];
      const n = parseInt(v, 10);
      if (!Number.isNaN(n) && n > 0) opts.queryCount = n;
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

function formatHuman(report) {
  const lines = [];
  lines.push(`${report.path}`);
  lines.push(`  provider: ${report.provider}`);
  const b = report.baseline;
  lines.push(
    `  baseline: score=${b.score}/100 hit=${b.hit_rate.positive_hits}/${b.hit_rate.positive_total} false=${b.hit_rate.false_positives}/${b.hit_rate.false_total}`,
  );
  if (report.variants.length > 0) {
    lines.push("  variants:");
    report.variants.forEach((v, i) => {
      lines.push(
        `    [${i}] score=${v.score}/100 hit=${v.hit_rate.positive_hits}/${v.hit_rate.positive_total} false=${v.hit_rate.false_positives}/${v.hit_rate.false_total}`,
      );
      lines.push(`        rationale: ${v.rationale}`);
      lines.push(`        text: ${v.text}`);
    });
  }
  return lines.join("\n") + "\n";
}

export async function optimizeVerb(args) {
  const opts = parseArgs(args);
  if (!opts.path) {
    return {
      exitCode: 64,
      output:
        "usage: skills-ref optimize <skill-dir> [--baseline-only] [--apply N] [--format human|json] [--query-count N]\n",
    };
  }
  const target = resolve(opts.path);
  let st;
  try {
    st = statSync(target);
  } catch {
    return { exitCode: 2, output: `no SKILL.md found under: ${opts.path}\n` };
  }
  if (!st.isDirectory()) {
    return { exitCode: 2, output: `not a directory: ${opts.path}\n` };
  }
  try {
    statSync(join(target, "SKILL.md"));
  } catch {
    return { exitCode: 2, output: `no SKILL.md found under: ${opts.path}\n` };
  }

  let report;
  try {
    report = await optimize(target, {
      baselineOnly: opts.baselineOnly,
      queryCount: opts.queryCount,
    });
  } catch (e) {
    return { exitCode: 1, output: `optimize: ${e.message}\n` };
  }

  if (opts.apply != null) {
    const idx = opts.apply;
    if (idx < 0 || idx >= report.variants.length) {
      return {
        exitCode: 64,
        output: `--apply ${idx}: variant index out of range (have ${report.variants.length})\n`,
      };
    }
    const variant = report.variants[idx];
    let backup;
    try {
      ({ backup } = applyVariant(target, variant));
    } catch (e) {
      return { exitCode: 1, output: `optimize --apply: ${e.message}\n` };
    }
    const v = await validate([
      target,
      "--extra-tiers",
      "company,enterprise,application",
      "--format",
      "json",
    ]);
    if (v.exitCode !== 0) {
      rollback(target, backup);
      return {
        exitCode: 1,
        output: `optimize --apply ${idx}: post-write validation failed; original restored.\n`,
      };
    }
    commit(backup);
    return {
      exitCode: 0,
      output: `optimize --apply ${idx}: wrote variant; validation OK.\n`,
    };
  }

  let output;
  if (opts.format === "json") {
    output = JSON.stringify(sortKeys(report)) + "\n";
  } else {
    output = formatHuman(report);
  }
  return { exitCode: 0, output };
}
