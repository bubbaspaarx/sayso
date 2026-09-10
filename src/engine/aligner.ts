import { areConfusable } from "./confusions";
import type { Token } from "./tokenise";

export type AlignOptions = {
  window: number; // expected tokens to look ahead from cursor
  maxSkip: number; // consecutive hard (non-soft) expected tokens the child may skip
  similarity: number; // normalised Levenshtein threshold for ordinary tokens
  gateSimilarity: number; // threshold for gate tokens (loosens on stall)
};

export const DEFAULT_ALIGN: AlignOptions = {
  window: 8,
  maxSkip: 2,
  similarity: 0.75,
  gateSimilarity: 0.75,
};

export type MatchDecision = {
  heard: string;
  expectedIndex: number | null; // null = heard token ignored
  expected?: string;
  via?: "exact" | "fuzzy" | "confusable" | "plural";
  skipped?: number[]; // expected indices skipped to reach this match
};

export type AlignResult = {
  cursor: number;
  matched: number[]; // expected indices matched in this call
  decisions: MatchDecision[];
  blockedByGate: number | null; // gate index that stopped progress, if any
};

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1);
  let cur = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

export function similarity(a: string, b: string): number {
  const L = Math.max(a.length, b.length);
  if (L === 0) return 1;
  return 1 - levenshtein(a, b) / L;
}

function pluralOf(a: string, b: string): boolean {
  return a === b + "s" || b === a + "s" || a === b + "es" || b === a + "es";
}

export function matches(
  heard: string,
  expected: string,
  threshold: number,
): MatchDecision["via"] | null {
  if (heard === expected) return "exact";
  if (areConfusable(heard, expected)) return "confusable";
  if (pluralOf(heard, expected)) return "plural";
  if (similarity(heard, expected) >= threshold) return "fuzzy";
  return null;
}

/**
 * Greedy monotonic alignment of newly-heard tokens against the expected window.
 * - Never moves the cursor backwards.
 * - May skip up to `maxSkip` consecutive hard tokens; soft tokens skip free.
 * - May NEVER skip a gate token (pickup word). The cursor parks on it until it is heard.
 */
export function align(
  expected: Token[],
  cursor: number,
  heard: string[],
  opts: AlignOptions = DEFAULT_ALIGN,
): AlignResult {
  let p = cursor;
  const matched: number[] = [];
  const decisions: MatchDecision[] = [];
  let blockedByGate: number | null = null;

  for (const h of heard) {
    let found: MatchDecision | null = null;
    let hardSkips = 0;
    const skipped: number[] = [];
    for (let j = p; j < Math.min(expected.length, p + opts.window); j++) {
      const t = expected[j];
      const thr = t.gate ? opts.gateSimilarity : opts.similarity;
      const via = matches(h, t.norm, thr);
      if (via) {
        // A match that skips a hard word must be earned by a substantive word.
        // Short heard tokens ("a", "uh") or soft targets may only match at the cursor,
        // otherwise a stray "a" hops across "A lantern. A blanket. And a song."
        const weak = h.length <= 2 || t.soft;
        if (weak && hardSkips > 0) break;
        found = { heard: h, expectedIndex: j, expected: t.norm, via, skipped: [...skipped] };
        break;
      }
      // Not this one. May we skip it and look further?
      if (t.gate) {
        blockedByGate = j;
        break;
      }
      if (!t.soft) hardSkips++;
      if (hardSkips > opts.maxSkip) break;
      skipped.push(j);
    }
    if (found && found.expectedIndex !== null) {
      matched.push(found.expectedIndex);
      p = found.expectedIndex + 1;
      decisions.push(found);
    } else {
      decisions.push({ heard: h, expectedIndex: null });
    }
  }

  // If progress ended parked on a gate, report it (for stall counting).
  if (p < expected.length && expected[p].gate) blockedByGate = p;
  else if (blockedByGate !== null && blockedByGate < p) blockedByGate = null;

  return { cursor: p, matched, decisions, blockedByGate };
}

/** Passage complete? Last token may be swallowed by ASR; with silence, last three may be. */
export function isComplete(
  expected: Token[],
  cursor: number,
  silenceMs: number,
  silenceThresholdMs = 2500,
): boolean {
  const n = expected.length;
  if (n === 0) return true;
  // Gates can never be bypassed by the safety valve.
  for (let i = cursor; i < n; i++) if (expected[i].gate) return false;
  if (cursor >= n - 1) return true;
  return cursor >= n - 3 && silenceMs >= silenceThresholdMs;
}
