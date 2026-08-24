import { loadAssets } from "../lint/scorer.mjs";
import { extractVerbsAndNouns } from "./generate.mjs";

function stripVaguePhrases(description, vague) {
  let out = description;
  for (const v of vague) {
    const re = new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    out = out.replace(re, "").replace(/\s+/g, " ").trim();
  }
  return out;
}

function leadsWithVerb(description, verbs) {
  const first = (description ?? "").trim().split(/\W+/)[0]?.toLowerCase();
  return first && verbs.has(first);
}

function pickAnchorVerb(parsed, verbs) {
  const { verbs: candidateVerbs } = extractVerbsAndNouns(parsed);
  for (const v of candidateVerbs) {
    if (verbs.has(v)) return v;
  }
  for (const v of ["scaffold", "validate", "audit", "score", "emit", "resolve", "lint", "optimize", "generate"]) {
    if (verbs.has(v)) return v;
  }
  return null;
}

function ensureTriggerPhrase(description, parsed) {
  if (/\b(use when|when |if |for )/i.test(description)) return description;
  const { nouns } = extractVerbsAndNouns(parsed);
  const noun = nouns[0] ?? "skill";
  return `${description.replace(/\s+$/, "")} Use when the user asks to work with the ${noun}.`;
}

function clampLength(description, low = 60, high = 300) {
  if (description.length >= low && description.length <= high) return description;
  if (description.length > high) {
    const cut = description.slice(0, high - 1);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.]+$/, "") + ".";
  }
  return description;
}

function capitalize(s) {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

/**
 * Three deterministic rewrites. Each emphasizes a different defect class so
 * the user sees varied options. Mutations are stable across runs.
 */
export function proposeVariantsDeterministic(parsed) {
  const { vague, verbs } = loadAssets();
  const base = (parsed.description ?? "").trim();

  // Variant 0: aggressive verb-prefix + trigger phrase
  let v0 = base;
  const anchor = pickAnchorVerb(parsed, verbs);
  if (anchor && !leadsWithVerb(v0, verbs)) {
    v0 = `${capitalize(anchor)} ${v0.replace(/^[A-Z]/, (c) => c.toLowerCase())}`;
  }
  v0 = ensureTriggerPhrase(v0, parsed);
  v0 = clampLength(v0);

  // Variant 1: vague-phrase scrub + trigger phrase
  let v1 = stripVaguePhrases(base, vague);
  if (anchor && !leadsWithVerb(v1, verbs)) {
    v1 = `${capitalize(anchor)} ${v1.replace(/^[A-Z]/, (c) => c.toLowerCase())}`;
  }
  v1 = ensureTriggerPhrase(v1, parsed);
  v1 = clampLength(v1);

  // Variant 2: length-tightening pass (length-first, then verb + trigger)
  let v2 = clampLength(stripVaguePhrases(base, vague));
  if (anchor && !leadsWithVerb(v2, verbs)) {
    v2 = `${capitalize(anchor)} ${v2.replace(/^[A-Z]/, (c) => c.toLowerCase())}`;
  }
  v2 = ensureTriggerPhrase(v2, parsed);
  v2 = clampLength(v2);

  return [
    { text: v0, rationale: "lead-with-verb + append trigger phrase" },
    { text: v1, rationale: "strip vague phrases + lead-with-verb + trigger" },
    { text: v2, rationale: "length-tighten + scrub + verb + trigger" },
  ];
}
