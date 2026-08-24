import { readFile } from "node:fs/promises";
import type { FailingLocator, FailureCategory } from "./types.js";

interface PlaywrightJsonReport {
  suites?: PwSuite[];
}
interface PwSuite {
  title: string;
  file?: string;
  suites?: PwSuite[];
  specs?: PwSpec[];
}
interface PwSpec {
  title: string;
  file: string;
  line: number;
  column?: number;
  tests?: PwTest[];
}
interface PwTest {
  results?: PwResult[];
}
interface PwResult {
  status: string;
  errors?: { message?: string; stack?: string; location?: { file: string; line: number; column?: number } }[];
}

const LOCATOR_ERROR_PATTERNS = [
  /locator resolved to 0 elements/i,
  /Timeout .* exceeded.*waiting for selector/i,
  /strict mode violation/i,
  /expected count: 1, received: 0/i,
  /element is not attached to the DOM/i,
];

const ASSERTION_PATTERNS = [
  /expect\(.*\)\..*to(Equal|Be|Have|Contain)/i,
  /Expected substring/i,
  /Expected value/i,
];

const INFRA_PATTERNS = [
  /ECONNREFUSED/i,
  /net::ERR_/i,
  /browserContext.* closed/i,
  /Target page, context or browser has been closed/i,
];

const SELECTOR_RX = /(?:page|frame|locator)\.(locator|getBy[A-Za-z]+)\(\s*(['"`])([^'"`]+)\2/;

export function classifyError(message: string): FailureCategory {
  if (LOCATOR_ERROR_PATTERNS.some((rx) => rx.test(message))) return "LOCATOR_DRIFT";
  if (INFRA_PATTERNS.some((rx) => rx.test(message))) return "INFRA_ERROR";
  if (ASSERTION_PATTERNS.some((rx) => rx.test(message))) return "ASSERTION_DRIFT";
  return "UNKNOWN";
}

export async function parsePlaywrightReport(path: string): Promise<{
  category: FailureCategory;
  failures: FailingLocator[];
}> {
  const raw = await readFile(path, "utf8");
  const report = JSON.parse(raw) as PlaywrightJsonReport;
  const failures: FailingLocator[] = [];
  let category: FailureCategory = "UNKNOWN";

  walk(report.suites ?? [], (spec, result) => {
    if (result.status === "passed" || result.status === "skipped") return;
    for (const err of result.errors ?? []) {
      const msg = (err.message ?? "") + "\n" + (err.stack ?? "");
      const c = classifyError(msg);
      if (c === "LOCATOR_DRIFT") category = "LOCATOR_DRIFT";
      else if (c !== "UNKNOWN" && category === "UNKNOWN") category = c;

      const selectorMatch = SELECTOR_RX.exec(msg);
      if (selectorMatch) {
        failures.push({
          testFile: err.location?.file ?? spec.file,
          line: err.location?.line ?? spec.line,
          column: err.location?.column ?? spec.column,
          api: selectorMatch[1],
          rawSelector: selectorMatch[3],
          message: err.message ?? "",
        });
      }
    }
  });

  return { category, failures };
}

function walk(
  suites: PwSuite[],
  visit: (spec: PwSpec, result: PwResult) => void,
): void {
  for (const s of suites) {
    for (const spec of s.specs ?? []) {
      for (const t of spec.tests ?? []) {
        for (const r of t.results ?? []) visit(spec, r);
      }
    }
    walk(s.suites ?? [], visit);
  }
}
