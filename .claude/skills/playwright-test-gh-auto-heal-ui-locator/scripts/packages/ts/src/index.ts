import { readFile } from "node:fs/promises";
import { parsePlaywrightReport } from "./parse-failure.js";
import { fingerprintFromElement, fingerprintFromSelector, loadDom } from "./fingerprint.js";
import { findCandidates } from "./locator-resolver.js";
import { rewriteTest } from "./rewrite-test.js";
import type { HealResult } from "./types.js";

export * from "./types.js";
export { classifyError, parsePlaywrightReport } from "./parse-failure.js";
export { fingerprintFromElement, fingerprintFromSelector } from "./fingerprint.js";
export { findCandidates, deriveLocator } from "./locator-resolver.js";
export { rewriteTest } from "./rewrite-test.js";
export { buildGithubPlan } from "./github-plan.js";
export type {
  GithubPlan,
  GithubPlanOptions,
  PrPlan,
  PrRewrite,
  IssuePlan,
} from "./github-plan.js";

export interface HealOptions {
  reportPath: string;
  newDomPath: string;
  baselineDomPath?: string;
  threshold?: number;
  dryRun?: boolean;
}

export async function heal(opts: HealOptions): Promise<HealResult[]> {
  const { reportPath, newDomPath, baselineDomPath, threshold = 0.75, dryRun = false } = opts;

  const { category, failures } = await parsePlaywrightReport(reportPath);
  if (category !== "LOCATOR_DRIFT") {
    return failures.map((f) => ({
      status: "HEAL_FAILED",
      testFile: f.testFile,
      failing: f,
      candidates: [],
    }));
  }

  const newHtml = await readFile(newDomPath, "utf8");
  const baselineHtml = baselineDomPath ? await readFile(baselineDomPath, "utf8") : null;
  const baselineDoc = baselineHtml ? loadDom(baselineHtml) : null;

  const results: HealResult[] = [];

  for (const failing of failures) {
    const fp = baselineDoc
      ? findTargetInBaseline(baselineDoc, failing.rawSelector) ??
        fingerprintFromSelector(failing.rawSelector)
      : fingerprintFromSelector(failing.rawSelector);

    const candidates = findCandidates(newHtml, fp, { threshold });

    if (candidates.length === 0) {
      results.push({
        status: "ELEMENT_REMOVED",
        testFile: failing.testFile,
        failing,
        candidates: [],
      });
      continue;
    }

    if (candidates.length > 1 && candidates[0].score === candidates[1].score) {
      results.push({
        status: "AMBIGUOUS",
        testFile: failing.testFile,
        failing,
        candidates,
      });
      continue;
    }

    const best = candidates[0];
    const rewrite = await rewriteTest(failing.testFile, failing, best.locator, { dryRun });
    results.push({
      status: rewrite.changed ? "HEALED" : "HEAL_FAILED",
      testFile: failing.testFile,
      failing,
      newLocator: best.locator,
      confidence: best.confidence,
      candidates,
      diff: rewrite.diff,
    });
  }

  return results;
}

function findTargetInBaseline(doc: Document, selector: string) {
  try {
    const el = doc.querySelector(selector);
    return el ? fingerprintFromElement(el) : null;
  } catch {
    return null;
  }
}
