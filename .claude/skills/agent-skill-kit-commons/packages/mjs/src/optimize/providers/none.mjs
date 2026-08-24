import { generateDeterministic } from "../generate.mjs";
import { proposeVariantsDeterministic } from "../rewrite.mjs";

export const PROVIDER_NAME = "none";

export async function generate(parsed, opts) {
  return generateDeterministic(parsed, opts.queryCount ?? 8);
}

export async function propose(parsed) {
  return proposeVariantsDeterministic(parsed);
}
