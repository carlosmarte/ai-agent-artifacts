import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = resolve(__dirname, "..", "..", "assets");

let _bank = null;
function loadNegativeBank() {
  if (_bank) return _bank;
  const text = readFileSync(
    resolve(ASSETS_DIR, "negative_query_bank.txt"),
    "utf8",
  );
  _bank = text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  return _bank;
}

const VERB_RE =
  /\b(scaffold|validate|audit|score|emit|resolve|lint|optimize|export|generate|sort|detect|warn|run|build|parse|check|wire|install|configure|rewrite|propose|tune)\b/g;

const NOUN_RE =
  /\b(skill|frontmatter|description|dependency|dependencies|registry|prompt|properties|graph|cycle|inversion|tier|fixture|workflow|hook|gate|comment|provider|variant|hit-rate|score|optimizer|integrator)\b/g;

function unique(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

export function extractVerbsAndNouns(parsed) {
  const body = (parsed.body ?? "").toLowerCase();
  const desc = (parsed.description ?? "").toLowerCase();
  const verbs = unique([
    ...(body.match(VERB_RE) ?? []),
    ...(desc.match(VERB_RE) ?? []),
  ]);
  const nouns = unique([
    ...(desc.match(NOUN_RE) ?? []),
    ...(body.match(NOUN_RE) ?? []),
  ]);
  return { verbs, nouns };
}

export function generateDeterministic(parsed, n = 8) {
  const { verbs, nouns } = extractVerbsAndNouns(parsed);
  const positive = [];
  for (let i = 0; i < n; i++) {
    const v = verbs[i % Math.max(1, verbs.length)] ?? "do";
    const noun = nouns[i % Math.max(1, nouns.length)] ?? "thing";
    positive.push(`${v} the ${noun}`);
  }
  const bank = loadNegativeBank();
  const negative = bank.slice(0, n);
  return { positive, negative };
}
