function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
    return out;
  }
  return v;
}

export function formatJson(report) {
  return JSON.stringify(sortKeys(report)) + "\n";
}

export function formatHuman(report, { color = true } = {}) {
  const c = color
    ? {
        red: (s) => `\x1b[31m${s}\x1b[0m`,
        yellow: (s) => `\x1b[33m${s}\x1b[0m`,
        green: (s) => `\x1b[32m${s}\x1b[0m`,
        dim: (s) => `\x1b[2m${s}\x1b[0m`,
      }
    : { red: (s) => s, yellow: (s) => s, green: (s) => s, dim: (s) => s };
  const lines = [];
  const tag =
    report.status === "PASS"
      ? c.green("PASS")
      : report.status === "WARN"
      ? c.yellow("WARN")
      : c.red("FAIL");
  lines.push(`${tag} ${report.path}`);
  for (const i of report.issues) {
    const icon = i.severity === "error" ? c.red("error") : c.yellow("warn");
    lines.push(`  ${icon} [${i.code}] ${i.field}: ${i.message}`);
  }
  lines.push(
    c.dim(
      `  ${report.summary.errors} errors, ${report.summary.warnings} warnings`,
    ),
  );
  return lines.join("\n") + "\n";
}
