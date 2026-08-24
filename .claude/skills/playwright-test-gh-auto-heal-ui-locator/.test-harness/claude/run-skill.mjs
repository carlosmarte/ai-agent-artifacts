#!/usr/bin/env node
// run-skill.mjs — agentic harness: drives the *real* skill through the Claude
// Agent SDK and scores the agent's decisions against the labeled fixtures.
//
// Where run-fixtures.mjs proves the TS package's logic deterministically, this
// proves the end-to-end skill: given a failing test + DOM snapshots, does the
// agent (loading SKILL.md + references) classify the drift, pick the right
// replacement locator, and route to PR-vs-issue correctly?
//
// For each scenario it builds an isolated workspace:
//   workspace/.claude/skills/playwright-ui-locator -> <skill root>   (symlink)
//   workspace/tests/<spec>, baseline.html, new.html, report.json
// then asks the agent to heal it WITHOUT touching GitHub (analysis + plan only),
// and to emit a final ```json block: { status, delivery, locator }.
//
// Performance metrics captured per scenario: tokens, cost (USD), turns, latency,
// plus whether the agent actually invoked the skill's CLI (skill-usage rate).
//
// Requires: ANTHROPIC_API_KEY and `npm install` in this dir. Skips gracefully
// (exit 0) if either is missing, unless --require is passed.
//
// Usage:
//   node run-skill.mjs [--fixtures <dir>] [--out <dir>] [--model <id>]
//                      [--max-turns N] [--only <id>] [--require] [--keep]

import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HARNESS_ROOT = resolve(HERE, "..");
const SKILL_ROOT = resolve(HARNESS_ROOT, "..");
const SKILL_NAME = "playwright-ui-locator"; // matches SKILL.md frontmatter `name:`
const CLI = join(SKILL_ROOT, "scripts", "packages", "ts", "dist", "cli.js");

function parseArgs(argv) {
  const o = {
    fixtures: join(HARNESS_ROOT, "fixtures"),
    out: join(HARNESS_ROOT, "metrics"),
    model: process.env.HARNESS_MODEL || undefined,
    maxTurns: 24,
    only: null,
    require: false,
    keep: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fixtures") o.fixtures = resolve(argv[++i]);
    else if (a === "--out") o.out = resolve(argv[++i]);
    else if (a === "--model") o.model = argv[++i];
    else if (a === "--max-turns") o.maxTurns = parseInt(argv[++i], 10);
    else if (a === "--only") o.only = argv[++i];
    else if (a === "--require") o.require = true;
    else if (a === "--keep") o.keep = true;
  }
  return o;
}

function skip(msg, code = 0) {
  console.log(`\n  [claude-harness] SKIPPED — ${msg}\n`);
  process.exit(code);
}

function synthReport(specPath, scn) {
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

function buildWorkspace(dir, scn) {
  const ws = mkdtempSync(join(tmpdir(), "pwheal-agent-"));
  // Mirror the skill into a discoverable .claude/skills/<name> location.
  mkdirSync(join(ws, ".claude", "skills"), { recursive: true });
  symlinkSync(SKILL_ROOT, join(ws, ".claude", "skills", SKILL_NAME), "dir");
  // Scenario artifacts.
  mkdirSync(join(ws, "tests"), { recursive: true });
  const specPath = join(ws, "tests", `${scn.id}.spec.ts`);
  cpSync(join(dir, "spec.ts"), specPath);
  cpSync(join(dir, "baseline.html"), join(ws, "baseline.html"));
  cpSync(join(dir, "new.html"), join(ws, "new.html"));
  writeFileSync(join(ws, "report.json"), JSON.stringify(synthReport(specPath, scn), null, 2), "utf8");
  return { ws, specPath };
}

function buildPrompt(ws, specPath, scn) {
  return `A Playwright test is failing because a UI change drifted a locator. Heal it using the **playwright-ui-locator** skill.

Inputs in this workspace (${ws}):
- Failing test:        ${specPath}
- Playwright report:   ${join(ws, "report.json")}  (the failing locator: page.${scn.failing.api}('${scn.failing.selector}'))
- Old DOM snapshot:    ${join(ws, "baseline.html")}
- New (current) DOM:   ${join(ws, "new.html")}

The skill's built CLI is at: ${CLI}
Use confidence threshold ${scn.threshold ?? 0.75}.

IMPORTANT constraints for this run:
- This is a sandbox. Do NOT push a branch, open a PR, or file an issue. There is no GitHub remote.
- Run the analysis + the \`github-plan\` step only. You may use \`scripts/open-github.sh --plan-only\` to preview, but never deliver.
- Do not edit the test file in the working tree.

When done, end your reply with a SINGLE fenced json block giving your conclusion:

\`\`\`json
{
  "status": "HEALED | AMBIGUOUS | ELEMENT_REMOVED | HEAL_FAILED",
  "delivery": "pr | issue",
  "locator": "<the replacement Playwright locator call, or null if not healed>"
}
\`\`\`
`;
}

function extractFinalJson(text) {
  const blocks = [...text.matchAll(/```json\s*([\s\S]*?)```/g)];
  if (blocks.length === 0) {
    // last resort: a bare {...} near the end
    const m = text.match(/\{[\s\S]*"status"[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
  }
  for (let i = blocks.length - 1; i >= 0; i--) {
    try { return JSON.parse(blocks[i][1].trim()); } catch { /* keep looking */ }
  }
  return null;
}

async function runScenarioAgent(query, dir, scn, opts) {
  const { ws, specPath } = buildWorkspace(dir, scn);
  const started = Date.now();
  let assistantText = "";
  const toolCalls = [];
  let usage = null, cost = 0, turns = 0, resultText = "";

  try {
    const stream = query({
      prompt: buildPrompt(ws, specPath, scn),
      options: {
        cwd: ws,
        settingSources: ["project"],
        skills: "all",
        allowedTools: ["Read", "Glob", "Grep", "Bash", "Write", "Edit"],
        permissionMode: "bypassPermissions",
        maxTurns: opts.maxTurns,
        ...(opts.model ? { model: opts.model } : {}),
      },
    });

    for await (const msg of stream) {
      if (msg.type === "assistant") {
        for (const block of msg.message?.content ?? []) {
          if (block.type === "text") assistantText += block.text + "\n";
          else if (block.type === "tool_use") {
            toolCalls.push({ name: block.name, input: block.input });
          }
        }
      } else if (msg.type === "result") {
        usage = msg.usage ?? null;
        cost = msg.total_cost_usd ?? msg.cost ?? 0;
        turns = msg.num_turns ?? 0;
        resultText = msg.result ?? "";
      }
    }
  } finally {
    if (!opts.keep) rmSync(ws, { recursive: true, force: true });
  }

  const fullText = assistantText + "\n" + resultText;
  const conclusion = extractFinalJson(fullText);
  const usedSkillCli = toolCalls.some(
    (t) => t.name === "Bash" && /cli\.js|open-github\.sh|github-plan/.test(JSON.stringify(t.input ?? "")),
  );

  return {
    conclusion,
    usedSkillCli,
    perf: {
      latencyMs: Date.now() - started,
      turns,
      costUsd: cost,
      inputTokens: usage?.input_tokens ?? null,
      outputTokens: usage?.output_tokens ?? null,
    },
    toolCallNames: toolCalls.map((t) => t.name),
    rawTail: fullText.slice(-600),
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!process.env.ANTHROPIC_API_KEY) {
    skip("ANTHROPIC_API_KEY is not set. Export it to run the agentic tier.", opts.require ? 2 : 0);
  }
  try {
    execFileSync("node", [CLI, "--help"], { stdio: "ignore" });
  } catch {
    skip(`skill CLI not built at ${CLI}. Run: (cd ${SKILL_ROOT} && ./setup.sh)`, opts.require ? 2 : 0);
  }

  let query;
  try {
    ({ query } = await import("@anthropic-ai/claude-agent-sdk"));
  } catch (e) {
    skip(
      `@anthropic-ai/claude-agent-sdk not installed. Run: (cd ${HERE} && npm install)\n  (${e.message})`,
      opts.require ? 2 : 0,
    );
  }

  let ids = readdirSync(opts.fixtures, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  if (opts.only) ids = ids.filter((id) => id === opts.only);

  console.log(`\n  Playwright UI-Locator skill — Claude Agent SDK harness`);
  console.log(`  model: ${opts.model ?? "(SDK default)"}   scenarios: ${ids.length}\n`);

  const results = [];
  for (const id of ids) {
    const dir = join(opts.fixtures, id);
    const scn = JSON.parse(readFileSync(join(dir, "scenario.json"), "utf8"));
    process.stdout.write(`  • ${id} … `);
    let r, error;
    try {
      r = await runScenarioAgent(query, dir, scn, opts);
    } catch (e) {
      error = String(e?.message ?? e);
      r = { conclusion: null, usedSkillCli: false, perf: {}, toolCallNames: [] };
    }
    const exp = scn.expected;
    const c = r.conclusion ?? {};
    const statusOK = c.status === exp.status;
    const deliveryOK = c.delivery === exp.delivery;
    const locatorOK =
      exp.locator == null
        ? c.locator == null || c.locator === "null"
        : typeof c.locator === "string" && c.locator.includes(exp.locator);
    const pass = statusOK && deliveryOK && locatorOK;
    console.log(pass ? "✓ PASS" : `✗ FAIL${error ? " (" + error.split("\n")[0] + ")" : ""}`);
    results.push({ id, title: scn.title, expected: exp, conclusion: r.conclusion, statusOK, deliveryOK, locatorOK, pass, usedSkillCli: r.usedSkillCli, perf: r.perf, toolCallNames: r.toolCallNames, error });
  }

  const m = computeMetrics(results);
  report(results, m);

  mkdirSync(opts.out, { recursive: true });
  writeFileSync(
    join(opts.out, "claude-metrics.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), tier: "agentic", model: opts.model ?? null, metrics: m, results }, null, 2) + "\n",
    "utf8",
  );

  process.exit(m.overall.pass === m.overall.total ? 0 : 1);
}

function computeMetrics(results) {
  const total = results.length || 1;
  const pass = results.filter((r) => r.pass).length;
  const agg = (sel) => results.filter(sel).length / total;
  const sum = (f) => results.reduce((s, r) => s + (f(r) || 0), 0);
  return {
    overall: { total: results.length, pass, accuracy: pass / total },
    dimensions: {
      statusAccuracy: agg((r) => r.statusOK),
      deliveryAccuracy: agg((r) => r.deliveryOK),
      locatorAccuracy: agg((r) => r.locatorOK),
      skillUsageRate: agg((r) => r.usedSkillCli),
    },
    performance: {
      totalCostUsd: sum((r) => r.perf?.costUsd),
      avgTurns: sum((r) => r.perf?.turns) / total,
      avgLatencyMs: sum((r) => r.perf?.latencyMs) / total,
      totalInputTokens: sum((r) => r.perf?.inputTokens),
      totalOutputTokens: sum((r) => r.perf?.outputTokens),
    },
  };
}

function pct(n) { return `${(n * 100).toFixed(1)}%`; }

function report(results, m) {
  console.log("\n  Metrics");
  console.log(`    overall accuracy    ${pct(m.overall.accuracy)}  (${m.overall.pass}/${m.overall.total})`);
  console.log(`    status accuracy     ${pct(m.dimensions.statusAccuracy)}`);
  console.log(`    delivery accuracy   ${pct(m.dimensions.deliveryAccuracy)}  (PR vs issue)`);
  console.log(`    locator accuracy    ${pct(m.dimensions.locatorAccuracy)}`);
  console.log(`    skill-usage rate    ${pct(m.dimensions.skillUsageRate)}  (agent actually ran the skill CLI)`);
  console.log(`    cost (total)        $${m.performance.totalCostUsd.toFixed(4)}`);
  console.log(`    avg turns           ${m.performance.avgTurns.toFixed(1)}`);
  console.log(`    avg latency         ${(m.performance.avgLatencyMs / 1000).toFixed(1)}s`);
  console.log(`    tokens in/out       ${m.performance.totalInputTokens}/${m.performance.totalOutputTokens}`);
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
