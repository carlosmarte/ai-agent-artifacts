#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { parsePlaywrightReport, classifyError } from "./parse-failure.js";
import { fingerprintFromElement, fingerprintFromSelector, loadDom } from "./fingerprint.js";
import { findCandidates } from "./locator-resolver.js";
import { rewriteTest } from "./rewrite-test.js";
import { heal } from "./index.js";
import { buildGithubPlan } from "./github-plan.js";
import type { HealResult } from "./types.js";

interface ParsedArgs {
  cmd: string;
  flags: Record<string, string>;
  positional: string[];
}

function parseArgs(argv: string[]): ParsedArgs {
  const [cmd, ...rest] = argv;
  const flags: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) {
      const name = a.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith("--")) {
        flags[name] = next;
        i++;
      } else {
        flags[name] = "true";
      }
    } else {
      positional.push(a);
    }
  }
  return { cmd: cmd ?? "help", flags, positional };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  switch (args.cmd) {
    case "classify":
      return cmdClassify(args);
    case "fingerprint":
      return cmdFingerprint(args);
    case "match":
      return cmdMatch(args);
    case "rewrite":
      return cmdRewrite(args);
    case "heal":
      return cmdHeal(args);
    case "github-plan":
      return cmdGithubPlan(args);
    case "help":
    case "--help":
    case "-h":
      return usage();
    default:
      console.error(`Unknown command: ${args.cmd}`);
      usage();
      process.exit(2);
  }
}

function usage(): void {
  console.log(`pw-ui-locator — auto-heal Playwright tests after DOM changes

Commands:
  classify   --report <playwright-json>
             Classify the failure as LOCATOR_DRIFT | ASSERTION_DRIFT | INFRA_ERROR | UNKNOWN.

  fingerprint --baseline <html-file> --selector <css>
             Print the fingerprint extracted from a baseline DOM for the failing selector.

  match      --new <html-file> --selector <css> [--baseline <html-file>] [--threshold 0.75]
             Print ranked candidate locators in the new DOM.

  rewrite    --file <test.spec.ts> --api locator --old '.btn-primary' \\
             --new "getByRole('button', { name: 'Place order' })" [--dry-run]
             Rewrite the failing locator in place. Writes a .bak unless --no-backup.

  heal       --report <pw-json> --new-dom <html> [--baseline <html>] [--threshold 0.75] [--dry-run]
             End-to-end: parse report, fingerprint, match, rewrite. Prints JSON HealResult[].
             NOTE: prefer --dry-run — the skill delivers fixes via PR/issue, not in-place edits.

  github-plan
             Turn analysis into a GitHub delivery plan (PR for confident heals, issue for the rest).
             Does NOT touch git, the working tree, or the network — only writes artifacts to --out.

             Two input modes:
               --results <heal.json>        consume a previously-produced HealResult[] JSON
               --report <pw-json> --new-dom <html> [--baseline <html>] [--threshold 0.75]
                                            run an internal dry-run heal first
             Common flags:
               --out <dir>                  artifact dir (default ./.pw-heal-plan)
               --repo <owner/repo>          target repo (driver falls back to origin remote)
               --base <branch>              PR base branch (driver falls back to repo default)
               --branch-prefix <name>       heal branch prefix (default playwright-heal)
`);
}

async function cmdClassify(args: ParsedArgs): Promise<void> {
  const report = required(args, "report");
  const { category, failures } = await parsePlaywrightReport(report);
  console.log(JSON.stringify({ category, failures }, null, 2));
}

async function cmdFingerprint(args: ParsedArgs): Promise<void> {
  const sel = required(args, "selector");
  if (args.flags.baseline) {
    const html = await readFile(args.flags.baseline, "utf8");
    const doc = loadDom(html);
    const el = doc.querySelector(sel);
    if (!el) {
      console.error(`Selector matched 0 elements in baseline.`);
      process.exit(1);
    }
    console.log(JSON.stringify(fingerprintFromElement(el), null, 2));
  } else {
    console.log(JSON.stringify(fingerprintFromSelector(sel), null, 2));
  }
}

async function cmdMatch(args: ParsedArgs): Promise<void> {
  const newHtml = await readFile(required(args, "new"), "utf8");
  const sel = required(args, "selector");
  const threshold = args.flags.threshold ? parseFloat(args.flags.threshold) : 0.75;

  let fp;
  if (args.flags.baseline) {
    const baseline = await readFile(args.flags.baseline, "utf8");
    const baselineDoc = loadDom(baseline);
    const el = baselineDoc.querySelector(sel);
    fp = el ? fingerprintFromElement(el) : fingerprintFromSelector(sel);
  } else {
    fp = fingerprintFromSelector(sel);
  }

  const candidates = findCandidates(newHtml, fp, { threshold });
  console.log(JSON.stringify(candidates, null, 2));
}

async function cmdRewrite(args: ParsedArgs): Promise<void> {
  const file = required(args, "file");
  const api = required(args, "api");
  const oldSel = required(args, "old");
  const newCall = required(args, "new");
  const dryRun = args.flags["dry-run"] === "true";
  const backup = args.flags["no-backup"] !== "true";
  const result = await rewriteTest(
    file,
    { testFile: file, line: 0, api, rawSelector: oldSel, message: "" },
    newCall,
    { dryRun, backup },
  );
  console.log(JSON.stringify(result, null, 2));
}

async function cmdHeal(args: ParsedArgs): Promise<void> {
  const results = await heal({
    reportPath: required(args, "report"),
    newDomPath: required(args, "new-dom"),
    baselineDomPath: args.flags.baseline,
    threshold: args.flags.threshold ? parseFloat(args.flags.threshold) : 0.75,
    dryRun: args.flags["dry-run"] === "true",
  });
  console.log(JSON.stringify(results, null, 2));
  const failedAny = results.some((r) => r.status !== "HEALED");
  if (failedAny) process.exitCode = 1;
}

async function cmdGithubPlan(args: ParsedArgs): Promise<void> {
  let results: HealResult[];
  if (args.flags.results) {
    const raw = await readFile(args.flags.results, "utf8");
    results = JSON.parse(raw) as HealResult[];
  } else {
    // Run a dry-run heal internally so analysis never writes to the working tree.
    results = await heal({
      reportPath: required(args, "report"),
      newDomPath: required(args, "new-dom"),
      baselineDomPath: args.flags.baseline,
      threshold: args.flags.threshold ? parseFloat(args.flags.threshold) : 0.75,
      dryRun: true,
    });
  }

  const plan = await buildGithubPlan(results, {
    outDir: args.flags.out ?? "./.pw-heal-plan",
    repo: args.flags.repo,
    base: args.flags.base,
    branchPrefix: args.flags["branch-prefix"],
  });
  console.log(JSON.stringify(plan, null, 2));
}

function required(args: ParsedArgs, name: string): string {
  const v = args.flags[name];
  if (!v) {
    console.error(`Missing required --${name}`);
    process.exit(2);
  }
  return v;
}

// classifyError is re-exported for downstream tooling; reference to keep TS happy.
void classifyError;
void writeFile;

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
