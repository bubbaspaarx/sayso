import type { Chapter, Passage } from "../content/schema";
import { align, isComplete, DEFAULT_ALIGN, type AlignResult } from "./aligner";
import { buildTokens, splitWords, type Token, type Word } from "./tokenise";
import { matches } from "./aligner";
import type { PassageRecord } from "./report";
import { levelText } from "../content/levels";

export type Screen = "title" | "passage" | "choice" | "puzzle" | "hint" | "end" | "report";

export type Reading = {
  passageId: string;
  narration?: string; // grown-up line; never listened for
  words: Word[];
  tokens: Token[];
  cursor: number;
  matched: Set<number>;
  skipped: Set<number>; // passed over without being heard
  recovered: Set<number>; // skipped, then read correctly later (after a correction)
  matchedAt: Map<number, { t: number; batch: number }>;
  stalls: Map<number, number>; // gate index → max attempts
  firedPickups: Set<string>; // item ids fired on this visit
  /** A skip-based match waiting for the next word to confirm it. */
  provisional: { index: number; skipped: number[]; cursorBefore: number } | null;
  cues: { itemId: string; at: number }[];
  complete: boolean;
  silenceMs: number;
  gateStall: { index: number; attempts: number } | null;
};

export type PuzzleState = {
  id: string;
  selected: string[];
  attempts: number;
  feedback: string | null;
  success: boolean;
};

export type DebugInfo = {
  lastAlignment: AlignResult | null;
  pickupLog: string[];
  events: string[];
};

export type State = {
  chapter: Chapter;
  stem: string; // content/<stem>.json — also the media folder
  levelId: string | null;
  screen: Screen;
  reading: Reading;
  bag: string[];
  justPicked: string | null; // for the bag animation
  puzzle: PuzzleState | null;
  debug: DebugInfo;
  debugPanel: boolean;
  history: PassageRecord[];
  batch: number; // increments per HEARD call; matches in one call share a timestamp
};

export type Action =
  | { type: "START" }
  | { type: "HEARD"; tokens: string[]; isFinal: boolean; at?: number }
  | { type: "SILENCE"; ms: number }
  | { type: "NEXT" }
  | { type: "CHOOSE"; next: string }
  | { type: "PUZZLE_TOGGLE"; itemId: string }
  | { type: "PUZZLE_TRY" }
  | { type: "PUZZLE_CONTINUE" }
  | { type: "HINT_DISMISS" }
  | { type: "RESTART" }
  | { type: "PICK_ANIM_DONE" }
  | { type: "TOGGLE_DEBUG" }
  | { type: "CUE_EXPIRE"; now: number }
  | { type: "REPORT_OPEN" }
  | { type: "REPORT_CLOSE" }
  | { type: "DEBUG_ADVANCE" }
  | { type: "DEBUG_SKIP" };

const GATE_LOOSEN = [
  { attempts: 3, threshold: 0.6 },
  { attempts: 6, threshold: 0.5 },
];

function gateThreshold(stall: Reading["gateStall"]): number {
  if (!stall) return DEFAULT_ALIGN.gateSimilarity;
  let thr = DEFAULT_ALIGN.gateSimilarity;
  for (const step of GATE_LOOSEN) if (stall.attempts >= step.attempts) thr = step.threshold;
  return thr;
}

/** Greedy monotonic count of heard tokens that fit the already-read window [lo, hi). */
function countBehindMatches(tokens: Token[], lo: number, hi: number, heard: string[]): number {
  let p = lo;
  let n = 0;
  for (const h of heard) {
    for (let j = p; j < hi; j++) {
      if (matches(h, tokens[j].norm, 0.75)) {
        n++;
        p = j + 1;
        break;
      }
    }
  }
  return n;
}

export function enterPassage(chapter: Chapter, passageId: string, levelId: string | null = null): Reading {
  const passage: Passage = chapter.passages[passageId];
  const { text, narration } = levelText(chapter, levelId, passageId);
  const words = splitWords(text);
  const tokens = buildTokens(words, {
    tolerant: chapter.tolerantTokens,
    gateWords: (passage.pickups ?? []).map((p) => p.match),
  });
  return {
    passageId,
    narration,
    words,
    tokens,
    cursor: 0,
    matched: new Set(),
    skipped: new Set(),
    recovered: new Set(),
    matchedAt: new Map(),
    stalls: new Map(),
    firedPickups: new Set(),
    provisional: null,
    cues: [],
    complete: tokens.length === 0,
    silenceMs: 0,
    gateStall: null,
  };
}

export function initialState(chapter: Chapter, debugPanel = false, stem = "chapter-01", levelId: string | null = null): State {
  return {
    chapter,
    stem,
    levelId,
    screen: "title",
    reading: enterPassage(chapter, chapter.start, levelId),
    bag: [],
    justPicked: null,
    puzzle: null,
    debug: { lastAlignment: null, pickupLog: [], events: [] },
    debugPanel,
    history: [],
    batch: 0,
  };
}

function log(d: DebugInfo, line: string): DebugInfo {
  const stamp = new Date().toISOString().slice(11, 19);
  return { ...d, events: [`${stamp} ${line}`, ...d.events].slice(0, 60) };
}

/** What comes after a finished passage. */
function recordPassage(r: Reading): PassageRecord {
  return {
    passageId: r.passageId,
    words: r.tokens.map((t) => t.norm),
    display: r.tokens.map((t) => r.words[t.wordIndex].text),
    matched: [...r.matched].sort((a, b) => a - b),
    skipped: [...r.skipped].filter((i) => !r.recovered.has(i)).sort((a, b) => a - b),
    recovered: [...r.recovered].sort((a, b) => a - b),
    stalls: [...r.stalls].map(([index, attempts]) => ({ index, attempts })),
    matchedAt: [...r.matchedAt].map(([index, m]) => ({ index, ...m })),
  };
}

function afterPassage(state: State): State {
  state = { ...state, history: [...state.history, recordPassage(state.reading)] };
  const p = state.chapter.passages[state.reading.passageId];
  if (p.choice) return { ...state, screen: "choice" };
  if (p.puzzle) {
    return {
      ...state,
      screen: "puzzle",
      puzzle: { id: p.puzzle, selected: [], attempts: 0, feedback: null, success: false },
    };
  }
  if (p.next) return goTo(state, p.next);
  return { ...state, screen: "end" };
}

function goTo(state: State, passageId: string): State {
  return {
    ...state,
    screen: "passage",
    reading: enterPassage(state.chapter, passageId, state.levelId),
    debug: log(state.debug, `→ passage ${passageId}`),
  };
}

function applyHeard(state: State, tokens: string[], isFinal: boolean, at = Date.now()): State {
  if (state.screen !== "passage" || tokens.length === 0) return state;
  const r = state.reading;
  if (r.cursor >= r.tokens.length) return state; // nothing left to hear
  // Note: we keep listening after `complete` so a swallowed tail can still be credited.

  const batch = state.batch + 1;
  const matched = new Set(r.matched);
  const matchedAt = new Map(r.matchedAt);
  const skipped = new Set(r.skipped);
  const recovered = new Set(r.recovered);

  // Late recovery first: a heard word that matches a recently skipped word (the adult
  // corrected the child, the child said it again) recovers that word and is NOT fed
  // forward — unless it is exactly the next expected word, in which case reading on wins.
  const forward: string[] = [];
  const next = r.tokens[r.cursor];
  for (const h of tokens) {
    const isNext = next ? matches(h, next.norm, next.gate ? gateThreshold(r.gateStall) : DEFAULT_ALIGN.similarity) : null;
    let hit: number | null = null;
    if (!isNext) {
      for (const i of [...skipped].sort((a, b) => b - a)) {
        if (i < r.cursor - 12 || recovered.has(i)) continue;
        if (matches(h, r.tokens[i].norm, 0.75)) { hit = i; break; }
      }
    }
    if (hit !== null) {
      recovered.add(hit);
      matched.add(hit);
      matchedAt.set(hit, { t: at, batch });
    } else forward.push(h);
  }

  const opts = { ...DEFAULT_ALIGN, gateSimilarity: gateThreshold(r.gateStall) };
  let debug: DebugInfo = { ...state.debug };

  // A pending skip-based match is confirmed only if this batch's first real match is
  // the very next word after it. Otherwise it is discarded and we align from before it.
  let result: AlignResult;
  let baseCursor = r.cursor;
  let provisional = r.provisional;
  if (provisional) {
    const confirm = align(r.tokens, provisional.index + 1, forward, opts);
    const firstMatch = confirm.decisions.find((d) => d.expectedIndex !== null);
    if (firstMatch && firstMatch.expectedIndex === provisional.index + 1 && !(firstMatch.skipped?.length)) {
      matched.add(provisional.index);
      matchedAt.set(provisional.index, { t: at, batch });
      for (const i of provisional.skipped) if (!matched.has(i)) skipped.add(i);
      result = confirm;
      baseCursor = provisional.index + 1;
      debug = log(debug, `confirmed skip → "${r.tokens[provisional.index].norm}"`);
    } else {
      result = align(r.tokens, r.cursor, forward, opts);
      debug = log(debug, `dropped unconfirmed skip → "${r.tokens[provisional.index].norm}"`);
    }
    provisional = null;
  } else {
    result = align(r.tokens, r.cursor, forward, opts);
  }

  // Re-read detection: if these words fit better behind the cursor than ahead of it,
  // the child is reading back over something already read. Hold still.
  if (forward.length >= 2) {
    const behind = countBehindMatches(r.tokens, Math.max(0, baseCursor - 12), baseCursor, forward);
    if (behind >= 2 && behind > result.matched.length) {
      debug = log(debug, `re-read (${behind} behind vs ${result.matched.length} ahead) — holding`);
      result = { cursor: baseCursor, matched: [], decisions: forward.map((h) => ({ heard: h, expectedIndex: null })), blockedByGate: null };
    }
  }

  // The last match of a batch that needed a hard skip is provisional: the cursor waits
  // for the next word to agree. One lucky word must not drag the story forward.
  const matchedDecisions = result.decisions.filter((d) => d.expectedIndex !== null);
  const last = matchedDecisions[matchedDecisions.length - 1];
  if (last && last.expectedIndex !== null && !r.tokens[last.expectedIndex].gate && (last.skipped ?? []).some((i) => !r.tokens[i].soft)) {
    const prev = matchedDecisions[matchedDecisions.length - 2];
    const cursorBefore = prev && prev.expectedIndex !== null ? prev.expectedIndex + 1 : baseCursor;
    provisional = { index: last.expectedIndex, skipped: last.skipped ?? [], cursorBefore };
    result = {
      ...result,
      cursor: cursorBefore,
      matched: result.matched.filter((m) => m !== last.expectedIndex),
      decisions: result.decisions.map((d) => (d === last ? { ...d, expectedIndex: null, via: undefined, provisional: true } : d)),
    };
    debug = log(debug, `provisional skip → "${r.tokens[last.expectedIndex].norm}" (waiting for "${r.tokens[last.expectedIndex + 1]?.norm ?? "end"}")`);
  }

  result.matched.forEach((m) => {
    matched.add(m);
    matchedAt.set(m, { t: at, batch });
  });
  // Words the cursor passed without hearing them.
  for (const d of result.decisions) if (d.expectedIndex !== null) for (const i of d.skipped ?? []) if (!matched.has(i)) skipped.add(i);

  // Cues: reading a cue word flashes its item above the text (not collected).
  const passage = state.chapter.passages[r.passageId];
  let cues = r.cues;
  for (const cue of passage.cues ?? []) {
    const hit = result.matched.some((m) => r.tokens[m].norm === cue.match.toLowerCase());
    if (hit) cues = [...cues, { itemId: cue.itemId, at }].slice(-8);
  }

  // Gate stall bookkeeping: count final utterances that failed to pass the gate.
  // An "attempt" is a final utterance that ended with unmatched words while parked on the gate.
  let gateStall = r.gateStall;
  if (result.blockedByGate !== null && result.cursor === result.blockedByGate) {
    if (!gateStall || gateStall.index !== result.blockedByGate) {
      gateStall = { index: result.blockedByGate, attempts: 0 };
    }
    const lastMatched = result.decisions.map((d) => d.expectedIndex !== null).lastIndexOf(true);
    const triedAndMissed = result.decisions.slice(lastMatched + 1).some((d) => d.expectedIndex === null);
    if (isFinal && triedAndMissed) gateStall = { ...gateStall, attempts: gateStall.attempts + 1 };
  } else {
    gateStall = null;
  }
  const stalls = new Map(r.stalls);
  if (gateStall && gateStall.attempts > 0) stalls.set(gateStall.index, Math.max(stalls.get(gateStall.index) ?? 0, gateStall.attempts));

  // Pickups: fire for gate tokens matched in this call, once per visit.
  let bag = state.bag;
  let justPicked = state.justPicked;
  const fired = new Set(r.firedPickups);
  debug = { ...debug, lastAlignment: result };
  for (const pk of passage.pickups ?? []) {
    if (fired.has(pk.itemId)) continue;
    const tok = r.tokens.find((t) => t.gate && t.norm === pk.match.toLowerCase());
    if (tok && result.matched.includes(tok.index)) {
      fired.add(pk.itemId);
      if (!bag.includes(pk.itemId)) bag = [...bag, pk.itemId];
      justPicked = pk.itemId;
      debug = { ...debug, pickupLog: [...debug.pickupLog, `${pk.itemId} @ ${r.passageId} (token ${tok.index})`] };
      debug = log(debug, `pickup ${pk.itemId}`);
    }
  }
  if (gateStall && gateStall.attempts > 0 && gateStall.attempts !== (r.gateStall?.attempts ?? 0)) {
    debug = log(debug, `gate stall on "${r.tokens[gateStall.index].norm}" attempt ${gateStall.attempts} thr ${gateThreshold(gateStall)}`);
  }

  const complete = r.complete || isComplete(r.tokens, result.cursor, 0);
  return {
    ...state,
    bag,
    justPicked,
    debug,
    batch,
    reading: {
      ...r,
      cursor: Math.max(baseCursor === r.cursor ? r.cursor : 0, result.cursor),
      matched,
      matchedAt,
      skipped,
      recovered,
      stalls,
      firedPickups: fired,
      provisional,
      cues,
      silenceMs: 0,
      gateStall,
      complete,
    },
  };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START":
      return { ...goTo(state, state.chapter.start), bag: [] };

    case "HEARD":
      return applyHeard(state, action.tokens, action.isFinal, action.at);

    case "DEBUG_ADVANCE": {
      const r = state.reading;
      if (state.screen !== "passage" || r.cursor >= r.tokens.length) return state;
      return applyHeard(state, [r.tokens[r.cursor].norm], true);
    }

    case "DEBUG_SKIP": {
      // Pretend the child mumbled the next word and read the one after it.
      const r = state.reading;
      if (state.screen !== "passage" || r.cursor + 1 >= r.tokens.length) return state;
      return applyHeard(state, r.tokens.slice(r.cursor + 1, r.cursor + 3).map((t) => t.norm), true);
    }

    case "SILENCE": {
      if (state.screen !== "passage" || state.reading.complete) return state;
      const complete = isComplete(state.reading.tokens, state.reading.cursor, action.ms);
      return { ...state, reading: { ...state.reading, silenceMs: action.ms, complete } };
    }

    case "NEXT":
      if (state.screen !== "passage" || !state.reading.complete) return state;
      return afterPassage(state);

    case "CHOOSE":
      if (state.screen !== "choice") return state;
      return goTo({ ...state, debug: log(state.debug, `choice → ${action.next}`) }, action.next);

    case "PUZZLE_TOGGLE": {
      if (state.screen !== "puzzle" || !state.puzzle || state.puzzle.success) return state;
      const q = state.chapter.puzzles[state.puzzle.id];
      const sel = state.puzzle.selected.includes(action.itemId)
        ? state.puzzle.selected.filter((i) => i !== action.itemId)
        : state.puzzle.selected.length < q.pickCount
          ? [...state.puzzle.selected, action.itemId]
          : state.puzzle.selected;
      return { ...state, puzzle: { ...state.puzzle, selected: sel, feedback: null } };
    }

    case "PUZZLE_TRY": {
      if (state.screen !== "puzzle" || !state.puzzle) return state;
      const q = state.chapter.puzzles[state.puzzle.id];
      const sel = state.puzzle.selected;
      if (sel.length !== q.pickCount) return state;
      const correct = sel.length === q.correct.length && q.correct.every((c) => sel.includes(c));
      if (correct) {
        return {
          ...state,
          puzzle: { ...state.puzzle, success: true, feedback: null },
          debug: log(state.debug, `puzzle ${q.id} solved`),
        };
      }
      const attempts = state.puzzle.attempts + 1;
      const showHint = attempts % q.hintAfterAttempts === 0;
      return {
        ...state,
        screen: showHint ? "hint" : "puzzle",
        puzzle: { ...state.puzzle, attempts, selected: [], feedback: q.wrongFeedback },
        debug: log(state.debug, `puzzle wrong [${sel.join(",")}] attempt ${attempts}${showHint ? " → hint" : ""}`),
      };
    }

    case "HINT_DISMISS":
      if (state.screen !== "hint") return state;
      return { ...state, screen: "puzzle", puzzle: state.puzzle && { ...state.puzzle, feedback: null } };

    case "PUZZLE_CONTINUE": {
      if (state.screen !== "puzzle" || !state.puzzle?.success) return state;
      const q = state.chapter.puzzles[state.puzzle.id];
      return goTo({ ...state, puzzle: null }, q.onSuccess);
    }

    case "PICK_ANIM_DONE":
      return state.justPicked ? { ...state, justPicked: null } : state;

    case "RESTART":
      return { ...initialState(state.chapter, state.debugPanel, state.stem, state.levelId), debug: log(state.debug, "restart") };

    case "TOGGLE_DEBUG":
      return { ...state, debugPanel: !state.debugPanel };

    case "CUE_EXPIRE": {
      const cues = state.reading.cues.filter((c) => action.now - c.at < 2600);
      return cues.length === state.reading.cues.length ? state : { ...state, reading: { ...state.reading, cues } };
    }

    case "REPORT_OPEN":
      return state.screen === "end" ? { ...state, screen: "report" } : state;

    case "REPORT_CLOSE":
      return state.screen === "report" ? { ...state, screen: "end" } : state;
  }
}
