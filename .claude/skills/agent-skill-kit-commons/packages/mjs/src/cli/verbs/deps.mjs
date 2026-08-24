import { resolve } from "node:path";
import { buildRegistry } from "../../registry.mjs";
import { topoSort, findMissingTargets } from "../../deps/toposort.mjs";
import { checkInversions } from "../../deps/inversion.mjs";
import { checkConflicts, checkUnpinned } from "../../deps/conflict.mjs";

function parseArgs(args) {
  const opts = { path: null, format: "human", strict: false, extraTiers: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--format") opts.format = args[++i];
    else if (a === "--strict") opts.strict = true;
    else if (a === "--extra-tiers")
      opts.extraTiers = (args[++i] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    else if (!a.startsWith("--") && opts.path == null) opts.path = a;
  }
  return opts;
}

export async function deps(args) {
  const opts = parseArgs(args);
  if (!opts.path) {
    return {
      exitCode: 64,
      output: "usage: skills-ref deps <root> [--format json|human] [--strict] [--extra-tiers ...]\n",
    };
  }
  const reg = buildRegistry(resolve(opts.path));
  const { order, cycles } = topoSort(reg);
  const missing = findMissingTargets(reg);
  const inversions = checkInversions(reg);
  const conflicts = checkConflicts(reg);
  const unpinned = checkUnpinned(reg);

  let exitCode = 0;
  if (cycles.length > 0 || inversions.length > 0) exitCode = 1;
  else if (missing.length > 0) exitCode = 2;
  else if (conflicts.length > 0) exitCode = 1;
  else if (opts.strict && unpinned.length > 0) exitCode = 2;

  if (opts.format === "json") {
    const body = sortKeys({
      order,
      cycles,
      missing,
      inversions,
      conflicts,
      unpinned,
      warnings: reg.warnings,
    });
    return { exitCode, output: JSON.stringify(body) + "\n" };
  }
  let out = "";
  out += `order: ${order.join(" -> ") || "(empty)"}\n`;
  if (cycles.length) {
    out += "cycles:\n";
    for (const c of cycles) out += `  - ${c.join(" -> ")}\n`;
  }
  if (missing.length) {
    out += "missing in-repo targets:\n";
    for (const m of missing) out += `  - ${m.from} -> ${m.to}\n`;
  }
  if (inversions.length) {
    out += "inversions:\n";
    for (const i of inversions)
      out += `  - ${i.from} (${i.fromTier}) -> ${i.to} (${i.toTier}) [downward dependency forbidden]\n`;
  }
  if (conflicts.length) {
    out += "conflicts:\n";
    for (const c of conflicts) out += `  - ${c.message}\n`;
  }
  if (unpinned.length) {
    out += "unpinned (WARN):\n";
    for (const u of unpinned) out += `  - ${u.message}\n`;
  }
  if (reg.warnings.length) {
    out += "registry warnings:\n";
    for (const w of reg.warnings) out += `  - ${w}\n`;
  }
  out += `\nsummary: ${cycles.length} cycle(s), ${inversions.length} inversion(s), ${missing.length} missing, ${conflicts.length} conflict(s), ${unpinned.length} unpinned\n`;
  return { exitCode, output: out };
}

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = sortKeys(v[k]);
    return o;
  }
  return v;
}
