const HEADER_FOOTER_CHARS = "<available_skills>\n</available_skills>\n".length;
const PER_ENTRY_OVERHEAD = '  <skill name="" tier=""></skill>\n'.length;

export function truncateToBudget(entries, maxTokens) {
  if (!maxTokens) return { kept: entries, dropped: 0 };
  const maxChars = maxTokens * 4;
  let used = HEADER_FOOTER_CHARS;
  const kept = [];
  for (const e of entries) {
    const cost =
      PER_ENTRY_OVERHEAD +
      (e.name?.length ?? 0) +
      (e.tier?.length ?? 0) +
      (e.description?.length ?? 0);
    if (used + cost > maxChars) break;
    used += cost;
    kept.push(e);
  }
  return { kept, dropped: entries.length - kept.length };
}
