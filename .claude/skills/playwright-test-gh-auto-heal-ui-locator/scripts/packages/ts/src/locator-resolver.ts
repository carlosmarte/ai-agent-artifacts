import { fingerprintFromElement, loadDom } from "./fingerprint.js";
import type { Candidate, ElementFingerprint } from "./types.js";

const WEIGHTS = {
  testid: 100,
  text: 60,
  roleAndName: 50,
  ancestorPath: 30,
  ariaLabel: 25,
  id: 20,
  tag: 10,
  classOverlap: 10,
};

const MAX_SCORE =
  WEIGHTS.testid +
  WEIGHTS.text +
  WEIGHTS.roleAndName +
  WEIGHTS.ancestorPath +
  WEIGHTS.ariaLabel +
  WEIGHTS.id +
  WEIGHTS.tag +
  WEIGHTS.classOverlap;

export interface MatchOptions {
  threshold?: number;
  maxCandidates?: number;
}

export function findCandidates(
  newDomHtml: string,
  target: ElementFingerprint,
  opts: MatchOptions = {},
): Candidate[] {
  const { threshold = 0.75, maxCandidates = 5 } = opts;
  const doc = loadDom(newDomHtml);

  const scored: Candidate[] = [];
  const all = doc.querySelectorAll("*");
  for (const el of Array.from(all)) {
    if (!isVisibleCandidate(el)) continue;
    const fp = fingerprintFromElement(el);
    const score = scoreMatch(target, fp);
    if (score <= 0) continue;
    scored.push({
      fingerprint: fp,
      locator: deriveLocator(el, fp),
      score,
      confidence: score / MAX_SCORE,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.filter((c) => c.confidence >= threshold).slice(0, maxCandidates);
}

function isVisibleCandidate(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "script" || tag === "style" || tag === "meta" || tag === "link") return false;
  return true;
}

function scoreMatch(target: ElementFingerprint, cand: ElementFingerprint): number {
  let score = 0;

  if (target.attrs["data-testid"] && target.attrs["data-testid"] === cand.attrs["data-testid"]) {
    score += WEIGHTS.testid;
  }

  if (target.text && cand.text && normalize(target.text) === normalize(cand.text)) {
    score += WEIGHTS.text;
  } else if (target.text && cand.text && normalize(cand.text).includes(normalize(target.text))) {
    score += Math.floor(WEIGHTS.text * 0.5);
  }

  if (target.attrs.role && target.attrs.role === cand.attrs.role) {
    const tName = target.attrs["aria-label"] ?? target.text;
    const cName = cand.attrs["aria-label"] ?? cand.text;
    if (tName && cName && normalize(tName) === normalize(cName)) score += WEIGHTS.roleAndName;
  }

  if (target.ancestors.length && cand.ancestors.length) {
    const overlap = countSuffixOverlap(target.ancestors, cand.ancestors);
    score += Math.round((overlap / Math.max(target.ancestors.length, 1)) * WEIGHTS.ancestorPath);
  }

  if (target.attrs["aria-label"] && target.attrs["aria-label"] === cand.attrs["aria-label"]) {
    score += WEIGHTS.ariaLabel;
  }

  if (target.attrs.id && target.attrs.id === cand.attrs.id) {
    score += WEIGHTS.id;
  }

  if (target.tag !== "*" && target.tag === cand.tag) {
    score += WEIGHTS.tag;
  }

  return score;
}

function countSuffixOverlap(a: string[], b: string[]): number {
  let i = a.length - 1;
  let j = b.length - 1;
  let n = 0;
  while (i >= 0 && j >= 0 && a[i] === b[j]) {
    n++;
    i--;
    j--;
  }
  return n;
}

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Pick the best Playwright locator expression for the matched element,
 * preferring stable semantic anchors over CSS.
 */
export function deriveLocator(el: Element, fp: ElementFingerprint): string {
  if (fp.attrs["data-testid"]) {
    return `getByTestId(${q(fp.attrs["data-testid"])})`;
  }

  const role = fp.attrs.role ?? implicitRole(fp.tag);
  const accessibleName = fp.attrs["aria-label"] ?? fp.text;
  if (role && accessibleName) {
    return `getByRole(${q(role)}, { name: ${q(accessibleName)} })`;
  }

  if (fp.tag === "input" || fp.tag === "textarea" || fp.tag === "select") {
    const label = findLabelText(el);
    if (label) return `getByLabel(${q(label)})`;
    if (fp.attrs.placeholder) return `getByPlaceholder(${q(fp.attrs.placeholder)})`;
    if (fp.attrs.name) return `locator(${q(`[name="${fp.attrs.name}"]`)})`;
  }

  if (fp.text && fp.text.length < 80) {
    return `getByText(${q(fp.text)}, { exact: true })`;
  }

  if (fp.attrs.id) {
    return `locator(${q(`#${fp.attrs.id}`)})`;
  }

  for (const k of ["data-test", "data-cy", "data-qa"]) {
    if (fp.attrs[k]) return `locator(${q(`[${k}="${fp.attrs[k]}"]`)})`;
  }

  return `locator(${q(cssPath(el))})`;
}

function implicitRole(tag: string): string | undefined {
  const map: Record<string, string> = {
    button: "button",
    a: "link",
    nav: "navigation",
    main: "main",
    header: "banner",
    footer: "contentinfo",
    h1: "heading",
    h2: "heading",
    h3: "heading",
    h4: "heading",
    img: "img",
    form: "form",
    ul: "list",
    ol: "list",
    li: "listitem",
  };
  return map[tag];
}

function findLabelText(el: Element): string | undefined {
  const id = el.getAttribute("id");
  if (!id) return undefined;
  const doc = el.ownerDocument;
  if (!doc) return undefined;
  const label = doc.querySelector(`label[for="${id}"]`);
  return label?.textContent?.trim() || undefined;
}

function cssPath(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.nodeType === 1 && parts.length < 5) {
    let part = cur.tagName.toLowerCase();
    if (cur.id) {
      part += `#${cur.id}`;
      parts.unshift(part);
      break;
    }
    const parent = cur.parentElement;
    if (parent) {
      const idx = Array.from(parent.children).indexOf(cur) + 1;
      part += `:nth-child(${idx})`;
    }
    parts.unshift(part);
    cur = cur.parentElement;
  }
  return parts.join(" > ");
}

function q(s: string): string {
  return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}
