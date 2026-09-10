import { mergeCompounds } from "./confusions";

/** A display chunk of the passage: one whitespace-separated word with its punctuation. */
export type Word = {
  text: string; // as rendered, e.g. `"Grandma!`
  norm: string; // e.g. `grandma` — empty if the chunk has no letters
  tokenIndex: number; // index into the expected token list, or -1
};

export type Token = {
  index: number;
  norm: string;
  wordIndex: number; // back to the display chunk
  soft: boolean; // may be skipped for free
  gate: boolean; // pickup word — may never be skipped
};

/** lowercase, strip punctuation, keep apostrophes inside words. */
export function normalise(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9']+/g, "")
    .replace(/^'+|'+$/g, "");
}

export function tokeniseTranscript(text: string): string[] {
  const toks = text.split(/\s+/).map(normalise).filter(Boolean);
  return mergeCompounds(toks);
}

export function splitWords(text: string): Word[] {
  const words: Word[] = [];
  let t = 0;
  for (const chunk of text.split(/\s+/).filter(Boolean)) {
    const norm = normalise(chunk);
    words.push({ text: chunk, norm, tokenIndex: norm ? t++ : -1 });
  }
  return words;
}

export function buildTokens(
  words: Word[],
  opts: { tolerant?: string[]; gateWords?: string[] },
): Token[] {
  const tolerant = new Set((opts.tolerant ?? []).map(normalise));
  const gates = new Set((opts.gateWords ?? []).map(normalise));
  const seenGate = new Set<string>();
  const tokens: Token[] = [];
  words.forEach((w, wi) => {
    if (w.tokenIndex < 0) return;
    // Only the FIRST occurrence of a pickup word in a passage is the gate.
    const isGate = gates.has(w.norm) && !seenGate.has(w.norm);
    if (isGate) seenGate.add(w.norm);
    tokens.push({
      index: w.tokenIndex,
      norm: w.norm,
      wordIndex: wi,
      soft: !isGate && (tolerant.has(w.norm) || w.norm.length <= 2),
      gate: isGate,
    });
  });
  return tokens;
}
