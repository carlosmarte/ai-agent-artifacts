import { validate } from "./verbs/validate.mjs";
import { deps } from "./verbs/deps.mjs";
import { audit } from "./verbs/audit.mjs";
import { lintVerb } from "./verbs/lint.mjs";
import { toPromptVerb } from "./verbs/to-prompt.mjs";
import { readPropertiesVerb } from "./verbs/read-properties.mjs";
import { optimizeVerb } from "./verbs/optimize.mjs";

const HELP_TEXT = `skills-ref — Agent Skills validator/linter/auditor toolkit

Usage:
  skills-ref <verb> [args] [flags]

Verbs:
  validate <path>          Validate one skill or a tree of skills (parser + naming + body + refs + dirs).
  deps <path>              Resolve dependency DAG, detect cycles, inversion, pin policy. (Feature 03)
  audit <path>             Run defensive security passes on frontmatter, scripts, deps. (Feature 03)
  lint <path>              Score description, flag vague language. (Feature 04)
  to-prompt <path>         Emit <available_skills> XML for stage-1 progressive disclosure. (Feature 05)
  read-properties <path>   Emit per-skill frontmatter properties as canonical JSON. (Feature 05)
  optimize <path>          Propose description rewrites against deterministic trigger queries. (Feature 06)

Common flags:
  --format human|json      Output format (default: human).
  --no-color               Disable ANSI colours.
  --strict                 Treat warnings as failures (exit 2).
  --extra-tiers a,b,c      Accept additional tier values beyond the spec's defaults.
`;

const VERBS = {
  validate,
  deps,
  audit,
  lint: lintVerb,
  "to-prompt": toPromptVerb,
  "read-properties": readPropertiesVerb,
  optimize: optimizeVerb,
};

export async function dispatch(argv) {
  const [verb, ...rest] = argv;
  if (!verb || verb === "--help" || verb === "-h") {
    return { exitCode: 0, output: HELP_TEXT };
  }
  if (verb === "--version" || verb === "-V") {
    return { exitCode: 0, output: "skills-ref 0.0.1\n" };
  }
  const fn = VERBS[verb];
  if (!fn) return { exitCode: 64, output: `unknown verb: ${verb}\n` };
  return await fn(rest);
}
