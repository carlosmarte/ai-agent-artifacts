const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };

export function xmlEscape(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
}

export function serializeAvailableSkills({ entries, truncated = 0 } = {}) {
  let out = "<available_skills>\n";
  for (const e of entries) {
    out += `  <skill name="${xmlEscape(e.name)}" tier="${xmlEscape(e.tier)}"`;
    if (e.invalid) out += ` invalid="true"`;
    out += `>${xmlEscape(e.description)}</skill>\n`;
  }
  if (truncated > 0) out += `  <truncated count="${truncated}"/>\n`;
  out += "</available_skills>\n";
  return out;
}
