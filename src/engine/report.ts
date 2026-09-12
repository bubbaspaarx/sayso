import type { Chapter } from "../content/schema";

/** Snapshot of one passage visit, taken when the child leaves it. */
export type PassageRecord = {
  passageId: string;
  words: string[]; // token norms
  display: string[]; // rendered chunk per token (with punctuation)
  matched: number[];
  skipped: number[]; // passed without being heard, never recovered
  recovered: number[]; // skipped, then read correctly after a correction
  stalls: { index: number; attempts: number }[];
  matchedAt: { index: number; t: number; batch: number }[];
};

export type Report = {
  passages: number;
  totalWords: number; // words with a verdict (matched or skipped)
  heard: number;
  skipped: number;
  recovered: number;
  accuracy: number; // heard / totalWords, 0..1
  practice: { word: string; count: number; stalled: boolean }[];
  corrected: string[];
  fullStops: { total: number; measured: number; paused: number; medianWithinMs: number | null };
};

const SENTENCE_END = /[.!?]["'”’)]*$/;

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function buildReport(history: PassageRecord[], _chapter?: Chapter): Report {
  let heard = 0, skipped = 0, recovered = 0;
  const practice = new Map<string, { count: number; stalled: boolean }>();
  const corrected: string[] = [];
  const within: number[] = [];
  const boundary: number[] = [];
  let totalStops = 0;

  for (const p of history) {
    heard += p.matched.length;
    skipped += p.skipped.length;
    recovered += p.recovered.length;
    for (const i of p.skipped) {
      const e = practice.get(p.words[i]) ?? { count: 0, stalled: false };
      e.count++;
      practice.set(p.words[i], e);
    }
    for (const s of p.stalls) {
      if (s.attempts < 1) continue;
      const w = p.words[s.index];
      const e = practice.get(w) ?? { count: 0, stalled: false };
      e.count++;
      e.stalled = true;
      practice.set(w, e);
    }
    for (const i of p.recovered) if (!corrected.includes(p.words[i])) corrected.push(p.words[i]);

    // Pauses: gap between consecutive matched tokens that arrived in different events.
    const at = new Map(p.matchedAt.map((m) => [m.index, m]));
    for (let i = 0; i < p.words.length - 1; i++) {
      const isEnd = SENTENCE_END.test(p.display[i]);
      if (isEnd) totalStops++;
      const a = at.get(i), b = at.get(i + 1);
      if (!a || !b || a.batch === b.batch) continue;
      const gap = b.t - a.t;
      if (gap < 0 || gap > 8000) continue; // silence timer / restart noise
      (isEnd ? boundary : within).push(gap);
    }
  }

  const medWithin = median(within);
  const threshold = Math.max(450, medWithin !== null ? medWithin * 1.6 : 450);
  const paused = boundary.filter((g) => g >= threshold).length;
  const totalWords = heard + skipped;

  return {
    passages: history.length,
    totalWords,
    heard,
    skipped,
    recovered,
    accuracy: totalWords ? heard / totalWords : 1,
    practice: [...practice.entries()]
      .map(([word, e]) => ({ word, ...e }))
      .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word)),
    corrected,
    fullStops: { total: totalStops, measured: boundary.length, paused, medianWithinMs: medWithin },
  };
}

export function reportAsText(r: Report, events: string[]): string {
  const lines = [
    `Sayso reading report`,
    `passages ${r.passages} · words ${r.totalWords} · heard ${r.heard} · not heard ${r.skipped} · corrected ${r.recovered}`,
    `accuracy ${(r.accuracy * 100).toFixed(0)}%`,
    `full stops: paused at ${r.fullStops.paused} of ${r.fullStops.measured} measured (${r.fullStops.total} in text)` +
      (r.fullStops.medianWithinMs !== null ? ` · typical gap between words ${Math.round(r.fullStops.medianWithinMs)}ms` : ""),
    ``,
    `words to practise:`,
    ...r.practice.map((p) => `  ${p.word} ×${p.count}${p.stalled ? " (stalled at a pickup)" : ""}`),
    ``,
    `corrected after a prompt: ${r.corrected.join(", ") || "—"}`,
    ``,
    `event log:`,
    ...events.slice().reverse().map((e) => `  ${e}`),
  ];
  return lines.join("\n");
}
