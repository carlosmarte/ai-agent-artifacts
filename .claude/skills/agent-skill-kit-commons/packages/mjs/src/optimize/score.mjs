import { loadAssets } from "../lint/scorer.mjs";

function tokenize(text) {
  return (text ?? "")
    .toLowerCase()
    .split(/\W+/)
    .filter(Boolean);
}

function contentWords(text, stop) {
  return tokenize(text).filter((t) => !stop.has(t));
}

function matches(query, descWords, stop) {
  const qw = contentWords(query, stop);
  if (qw.length === 0) return false;
  return qw.some((w) => descWords.has(w));
}

export function hitRate(description, queries) {
  const { stop } = loadAssets();
  const descWords = new Set(contentWords(description, stop));
  const positive = queries.positive ?? [];
  const negative = queries.negative ?? [];
  const positive_hits = positive.filter((q) => matches(q, descWords, stop)).length;
  const false_positives = negative.filter((q) => matches(q, descWords, stop)).length;
  const positive_total = positive.length;
  const false_total = negative.length;
  const tp_rate = positive_total ? positive_hits / positive_total : 0;
  const fp_rate = false_total ? false_positives / false_total : 0;
  const score = Math.max(0, Math.min(100, Math.round((tp_rate - fp_rate) * 100)));
  return {
    positive_hits,
    positive_total,
    false_positives,
    false_total,
    score,
  };
}
