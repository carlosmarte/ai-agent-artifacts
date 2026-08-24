#!/usr/bin/env node
// run-fixtures.mjs — deterministic correctness + performance harness.
//
// For each labeled scenario under ./fixtures/<id>/ it:
//   1. copies the scenario spec into a throwaway working dir,
//   2. synthesizes a Playwright JSON report pointing at that spec,
//   3. runs the skill's `cli.js github-plan` (dry-run heal → PR/issue plan),
//   4. compares the resulting plan.json against the scenario's ground truth,
//   5. aggregates accuracy / precision / recall metrics.
//
// No network and no API key required — this is the fast regression gate that
// proves the skill's analysis + delivery-split logic behaves as specified.
//
// Usage:
//   node run-fixtures.mjs [--fixtures <dir>] [--out <metrics-dir>] [--json] [--keep]

import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(HERE, "..");
const CLI = join(SKILL_ROOT, "scripts", "packages", "ts", "dist", "cli.js");

function parseArgs(argv) {
  const o = { fixtures: join(HERE, "fixtures"), out: join(HERE, "metrics"), json: false, keep: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fixtures") o.fixtures = resolve(argv[++i]);
    else if (a === "--out") o.out = resolve(argv[++i]);
    else if (a === "--json") o.json = true;
    else if (a === "--keep") o.keep = true;
  }
  return o;
}

// Build a minimal Playwright JSON report carrying one failing locator.
function synthReport(specPath, scn) {
  const { api, selector } = scn.failing;
  const line = scn.specLine ?? 1;
  return {
    suites: [
      {
        title: scn.id,
        file: specPath,
        specs: [
          {
            title: scn.title,
            file: specPath,
            line,
            column: 3,
            tests: [
              {
                results: [
                  {
                    status: "failed",
                    errors: [
                      {
                        message: scn.errorMessage,
                        stack: `Error\n    at ${specPath}:${line}:3`,
                        location: { file: specPath, line, column: 3 },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function runScenario(dir, scn) {
  const work = mkdtempSync(join(tmpdir(), "pwheal-fix-"));
  try {
    // 1. spec copy at the path the report will reference
    const specPath = join(work, "spec.ts");
    cpSync(join(dir, "spec.ts"), specPath);

    // 2. synth report
    const reportPath = join(work, "report.json");
    writeFileSync(reportPath, JSON.stringify(synthReport(specPath, scn)), "utf8");

    // 3. github-plan
    const outDir = join(work, "plan");
    execFileSync(
      "node",
      [
        CLI,
        "github-plan",
        "--report", reportPath,
        "--new-dom", join(dir, "new.html"),
        "--baseline", join(dir, "baseline.html"),
        "--threshold", String(scn.threshold ?? 0.75),
        "--out", outDir,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    const plan = JSON.parse(readFileSync(join(outDir, "plan.json"), "utf8"));

    // Derive the actual outcome for the single failing locator in the scenario.
    let status, delivery, locator;
    if (plan.pr && plan.pr.rewrites.length > 0) {
      status = "HEALED";
      delivery = "pr";
      locator = plan.pr.rewrites[0].new;
    } else if (plan.issues.length > 0) {
      status = plan.issues[0].status;
      delivery = "issue";
      locator = null;
    } else {
      status = "NONE";
      delivery = "none";
      locator = null;
    }
    return { status, delivery, locator, raw: plan };
  } finally {
    if (!process.env.KEEP_WORK) rmSync(work, { recursive: true, force: true });
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  try {
    execFileSync("node", [CLI, "--help"], { stdio: "ignore" });
  } catch {
    console.error(`✗ CLI not built at ${CLI}\n  Run: (cd ${SKILL_ROOT} && ./setup.sh)`);
    process.exit(2);
  }

  const ids = readdirSync(opts.fixtures, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const results = [];
  for (const id of ids) {
    const dir = join(opts.fixtures, id);
    const scn = JSON.parse(readFileSync(join(dir, "scenario.json"), "utf8"));
    let actual, error;
    try {
      actual = runScenario(dir, scn);
    } catch (e) {
      error = e.stderr ? e.stderr.toString() : String(e);
      actual = { status: "ERROR", delivery: "error", locator: null };
    }
    const exp = scn.expected;
    const statusOK = actual.status === exp.status;
    const deliveryOK = actual.delivery === exp.delivery;
    const locatorOK =
      exp.locator == null ? actual.locator == null : actual.locator === exp.locator;
    const pass = statusOK && deliveryOK && locatorOK;
    results.push({ id, title: scn.title, threshold: scn.threshold ?? 0.75, expected: exp, actual, statusOK, deliveryOK, locatorOK, pass, error });
  }

  const metrics = computeMetrics(results);
  report(results, metrics, opts.json);

  mkdirSync(opts.out, { recursive: true });
  writeFileSync(
    join(opts.out, "fixtures-metrics.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), tier: "deterministic", metrics, results }, null, 2) + "\n",
    "utf8",
  );

  process.exit(metrics.overall.pass === metrics.overall.total ? 0 : 1);
}

function computeMetrics(results) {
  const total = results.length;
  const pass = results.filter((r) => r.pass).length;
  const statusAcc = results.filter((r) => r.statusOK).length / total;
  const deliveryAcc = results.filter((r) => r.deliveryOK).length / total;
  const locatorAcc = results.filter((r) => r.locatorOK).length / total;

  // PR-decision confusion matrix: positive class = "should open a PR".
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const r of results) {
    const expPR = r.expected.delivery === "pr";
    const actPR = r.actual.delivery === "pr";
    if (expPR && actPR) tp++;
    else if (!expPR && actPR) fp++;
    else if (!expPR && !actPR) tn++;
    else fn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    overall: { total, pass, accuracy: pass / total },
    dimensions: { statusAccuracy: statusAcc, deliveryAccuracy: deliveryAcc, locatorAccuracy: locatorAcc },
    prDecision: { tp, fp, tn, fn, precision, recall, f1 },
  };
}

function pct(n) {
  return `${(n * 100).toFixed(1)}%`;
}

function report(results, m, asJson) {
  if (asJson) {
    console.log(JSON.stringify({ metrics: m, results }, null, 2));
    return;
  }
  console.log("\n  Playwright UI-Locator skill — deterministic fixture harness\n");
  console.log(
    "  " +
      "scenario".padEnd(24) +
      "thr".padEnd(6) +
      "expect".padEnd(24) +
      "actual".padEnd(24) +
      "result",
  );
  console.log("  " + "-".repeat(84));
  for (const r of results) {
    const mark = r.pass ? "✓ PASS" : "✗ FAIL";
    console.log(
      "  " +
        r.id.padEnd(24) +
        String(r.threshold).padEnd(6) +
        `${r.expected.status}/${r.expected.delivery}`.padEnd(24) +
        `${r.actual.status}/${r.actual.delivery}`.padEnd(24) +
        mark,
    );
    if (!r.pass) {
      if (!r.locatorOK) console.log(`      locator: expected ${JSON.stringify(r.expected.locator)} got ${JSON.stringify(r.actual.locator)}`);
      if (r.error) console.log(`      error: ${r.error.split("\n")[0]}`);
    }
  }
  console.log("\n  Metrics");
  console.log(`    overall accuracy    ${pct(m.overall.accuracy)}  (${m.overall.pass}/${m.overall.total} scenarios fully correct)`);
  console.log(`    status accuracy     ${pct(m.dimensions.statusAccuracy)}`);
  console.log(`    delivery accuracy   ${pct(m.dimensions.deliveryAccuracy)}  (PR vs issue routing)`);
  console.log(`    locator accuracy    ${pct(m.dimensions.locatorAccuracy)}  (exact derived locator)`);
  const p = m.prDecision;
  console.log(`    PR-decision         precision ${pct(p.precision)}  recall ${pct(p.recall)}  f1 ${pct(p.f1)}`);
  console.log(`                        tp=${p.tp} fp=${p.fp} tn=${p.tn} fn=${p.fn}`);
  console.log("");
}

main();
