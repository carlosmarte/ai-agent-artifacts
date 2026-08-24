import { resolve } from "node:path";
import { buildRegistry } from "../../registry.mjs";
import { auditFrontmatter } from "../../audit/frontmatter.mjs";
import { auditScripts } from "../../audit/scripts.mjs";
import { auditDepOrigins } from "../../audit/deps_origin.mjs";
import { auditPathLeak } from "../../audit/path_leak.mjs";
import { formatAudit } from "../../audit/printer.mjs";

const PASSES = new Set(["frontmatter", "scripts", "deps", "path-leak"]);

function parseArgs(args) {
  const opts = {
    path: null,
    format: "human",
    strict: false,
    allowedOrigins: null, // null = not set; [] = set but empty
    skip: new Set(),
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--format") opts.format = args[++i];
    else if (a === "--strict") opts.strict = true;
    else if (a === "--allowed-origins") {
      const v = args[++i] ?? "";
      opts.allowedOrigins = v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === "--skip") {
      const v = args[++i] ?? "";
      for (const s of v.split(",").map((x) => x.trim()).filter(Boolean)) {
        if (PASSES.has(s)) opts.skip.add(s);
      }
    } else if (!a.startsWith("--") && opts.path == null) opts.path = a;
  }
  return opts;
}

export async function audit(args) {
  const opts = parseArgs(args);
  if (!opts.path) {
    return {
      exitCode: 64,
      output:
        "usage: skills-ref audit <root> [--format json|human] [--strict] [--allowed-origins a,b] [--skip frontmatter|scripts|deps|path-leak]\n",
    };
  }
  const reg = buildRegistry(resolve(opts.path));
  const findings = [];
  if (!opts.skip.has("frontmatter")) findings.push(...auditFrontmatter(reg));
  if (!opts.skip.has("scripts")) findings.push(...auditScripts(reg));
  if (!opts.skip.has("deps"))
    findings.push(
      ...auditDepOrigins(reg, { allowedOrigins: opts.allowedOrigins }),
    );
  if (!opts.skip.has("path-leak")) findings.push(...auditPathLeak(reg));

  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of findings) {
    if (counts[f.severity] !== undefined) counts[f.severity]++;
  }
  let exitCode = 0;
  if (counts.HIGH > 0) exitCode = 1;
  else if (opts.strict && counts.MEDIUM > 0) exitCode = 1;
  const output = formatAudit(findings, opts.format);
  return { exitCode, output };
}
