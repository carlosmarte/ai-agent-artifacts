/**
 * Format the union of audit findings as either compact JSON or human text.
 * Findings are sorted into HIGH → MEDIUM → LOW buckets; within a bucket,
 * iteration order is preserved.
 */
export function formatAudit(findings, format = "human") {
  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of findings) {
    if (counts[f.severity] !== undefined) counts[f.severity]++;
  }
  if (format === "json") {
    return JSON.stringify(sortKeys({ summary: counts, findings })) + "\n";
  }
  let out = "";
  for (const sev of ["HIGH", "MEDIUM", "LOW"]) {
    for (const f of findings) {
      if (f.severity !== sev) continue;
      out += `[${sev}] ${f.code} ${f.where}: ${f.message}\n`;
    }
  }
  out += `\nsummary: ${counts.HIGH} HIGH, ${counts.MEDIUM} MEDIUM, ${counts.LOW} LOW\n`;
  return out;
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
