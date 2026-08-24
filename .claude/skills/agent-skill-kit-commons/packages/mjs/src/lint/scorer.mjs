import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = resolve(__dirname, "..", "..", "assets");

let _cached = null;

export function loadAssets() {
  if (_cached) return _cached;
  const read = (n) =>
    readFileSync(resolve(ASSETS_DIR, n), "utf8")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  _cached = {
    vague: read("vague_phrases.txt").map((s) => s.toLowerCase()),
    verbs: new Set(read("action_verbs.txt").map((s) => s.toLowerCase())),
    stop: new Set(read("stop_words.txt").map((s) => s.toLowerCase())),
  };
  return _cached;
}

function tokenize(text) {
  return (text ?? "")
    .toLowerCase()
    .split(/\W+/)
    .filter(Boolean);
}

export function scoreDescription(description, body) {
  const { vague, verbs, stop } = loadAssets();
  const desc = (description ?? "").toLowerCase();
  const tokens = tokenize(desc);
  const bodyTokens = tokenize(body).filter((t) => !stop.has(t));
  const bodySet = new Set(bodyTokens);

  // 1. Keyword density (0-25)
  const descKeywords = tokens.filter((t) => !stop.has(t));
  const overlap = descKeywords.filter((t) => bodySet.has(t)).length;
  const denom = Math.max(1, descKeywords.length);
  const keywordDensity = Math.min(25, Math.round((overlap / denom) * 25));

  // 2. Action verbs (0-20)
  const firstVerb = tokens.length > 0 && verbs.has(tokens[0]) ? 12 : 0;
  const anyVerb = tokens.some((t) => verbs.has(t)) ? 8 : 0;
  const actionVerbs = Math.min(20, firstVerb + anyVerb);

  // 3. Trigger phrases (0-20) — "use when", "when", "if", "for"
  const triggerPhrases = /\b(?:use when|when |if |for )/.test(desc) ? 20 : 0;

  // 4. Specificity / vague-phrase avoidance (0-20)
  const vagueHits = vague.filter((p) => desc.includes(p));
  const specificity = Math.max(0, 20 - vagueHits.length * 5);

  // 5. Length sweet spot 60-300 (0-15)
  const len = (description ?? "").length;
  let length;
  if (len < 60) length = Math.round((len / 60) * 15);
  else if (len > 300) length = Math.max(0, 15 - Math.round((len - 300) / 50));
  else length = 15;

  const score = Math.min(
    100,
    keywordDensity + actionVerbs + triggerPhrases + specificity + length,
  );

  const warnings = [];
  if (vagueHits.length > 0) {
    warnings.push(`vague phrases found: ${vagueHits.join(", ")}`);
  }
  if (firstVerb === 0) {
    warnings.push("description does not lead with an action verb");
  }
  if (triggerPhrases === 0) {
    warnings.push(
      "description lacks a trigger phrase ('when', 'if', 'use when', 'for')",
    );
  }

  return {
    score,
    breakdown: {
      keywordDensity,
      actionVerbs,
      triggerPhrases,
      specificity,
      length,
    },
    warnings,
  };
}
