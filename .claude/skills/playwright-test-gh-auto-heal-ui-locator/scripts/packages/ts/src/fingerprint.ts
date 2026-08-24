import { JSDOM } from "jsdom";
import type { ElementFingerprint } from "./types.js";

const STABLE_ATTRS = [
  "id",
  "role",
  "aria-label",
  "aria-labelledby",
  "data-testid",
  "data-test",
  "data-cy",
  "data-qa",
  "name",
  "placeholder",
  "title",
  "type",
  "for",
  "href",
];

export function loadDom(html: string): Document {
  return new JSDOM(html).window.document;
}

export function fingerprintFromElement(el: Element): ElementFingerprint {
  const attrs: Record<string, string> = {};
  for (const name of STABLE_ATTRS) {
    const v = el.getAttribute(name);
    if (v !== null && v !== "") attrs[name] = v;
  }
  return {
    tag: el.tagName.toLowerCase(),
    text: collapse(el.textContent ?? "") || undefined,
    attrs,
    ancestors: ancestorChain(el),
    siblingIndex: siblingIndexOf(el),
  };
}

/**
 * Build a partial fingerprint from a raw selector string when no baseline DOM
 * is available. We can at least extract the tag (if a type selector), the id,
 * classes, and any [attr=value] pieces.
 */
export function fingerprintFromSelector(selector: string): ElementFingerprint {
  const attrs: Record<string, string> = {};
  let tag = "*";

  const tagMatch = /^([a-zA-Z][\w-]*)/.exec(selector);
  if (tagMatch) tag = tagMatch[1].toLowerCase();

  const idMatch = /#([\w-]+)/.exec(selector);
  if (idMatch) attrs.id = idMatch[1];

  for (const m of selector.matchAll(/\[([\w-]+)=["']?([^"'\]]+)["']?\]/g)) {
    if (STABLE_ATTRS.includes(m[1])) attrs[m[1]] = m[2];
  }

  return { tag, attrs, ancestors: [], siblingIndex: -1 };
}

function ancestorChain(el: Element, depth = 3): string[] {
  const chain: string[] = [];
  let cur = el.parentElement;
  while (cur && chain.length < depth) {
    const role = cur.getAttribute("role");
    chain.unshift(role ? `${cur.tagName.toLowerCase()}[role=${role}]` : cur.tagName.toLowerCase());
    cur = cur.parentElement;
  }
  return chain;
}

function siblingIndexOf(el: Element): number {
  if (!el.parentElement) return 0;
  return Array.from(el.parentElement.children).indexOf(el);
}

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 200);
}
