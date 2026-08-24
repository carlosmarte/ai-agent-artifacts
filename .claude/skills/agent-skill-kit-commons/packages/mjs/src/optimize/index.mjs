import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "../parser.mjs";
import { scoreDescription } from "../lint/scorer.mjs";
import { hitRate } from "./score.mjs";
import * as none from "./providers/none.mjs";

function scoreVariant(text, body, queries) {
  const lint = scoreDescription(text, body);
  const hr = hitRate(text, queries);
  return {
    text,
    score: lint.score,
    breakdown: lint.breakdown,
    hit_rate: hr,
  };
}

/**
 * @param {string} skillDir
 * @param {object} opts
 *   - baselineOnly: bool
 *   - queryCount: number
 */
export async function optimize(skillDir, opts = {}) {
  const path = join(skillDir, "SKILL.md");
  const text = readFileSync(path, "utf8");
  const parsed = parseFrontmatter(text);
  const queries = await none.generate(parsed, opts);

  const baseline = scoreVariant(parsed.description ?? "", parsed.body ?? "", queries);

  let variants = [];
  if (!opts.baselineOnly) {
    const proposed = await none.propose(parsed, opts);
    variants = proposed.map((v) =>
      scoreVariant(v.text, parsed.body ?? "", queries),
    );
    variants = variants.map((v, i) => ({ ...v, rationale: proposed[i].rationale }));
    variants.sort((a, b) => b.score - a.score);
    variants = variants.slice(0, 3);
  }

  return {
    path,
    provider: "none",
    baseline,
    variants,
    queries,
  };
}
