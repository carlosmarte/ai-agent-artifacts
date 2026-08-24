import { scoreDescription } from "./scorer.mjs";
import { checkVendorNeutrality } from "./neutrality.mjs";
import { checkReferences } from "../rules/references.mjs";

function stripSourceOffset(i) {
  // Drop source_offset (always null for lint issues) so canonical JSON
  // matches the py side, which also omits it.
  // eslint-disable-next-line no-unused-vars
  const { source_offset, ...rest } = i;
  return rest;
}

export function lint(parsed, skillDir) {
  const { score, breakdown, warnings } = scoreDescription(
    parsed.description,
    parsed.body,
  );
  const issues = [
    ...checkVendorNeutrality(parsed),
    ...checkReferences(parsed, skillDir).map(stripSourceOffset),
    ...warnings.map((w) => ({
      code: "L002_DESCRIPTION_QUALITY",
      severity: "warn",
      field: "description",
      message: w,
    })),
  ];
  return { score, breakdown, issues };
}

export { scoreDescription, loadAssets } from "./scorer.mjs";
export { checkVendorNeutrality } from "./neutrality.mjs";
