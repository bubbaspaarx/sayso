import type { Chapter, Passage } from "../content/schema";
import { align, isComplete, DEFAULT_ALIGN, type AlignResult } from "./aligner";
import { buildTokens, splitWords, type Token, type Word } from "./tokenise";

export type Screen = "title" | "passage" | "choice" | "puzzle" | "hint" | "end";

export type Reading = {
  passageId: string;
  words: Word[];
  tokens: Token[];
  cursor: number;
  matched: Set<number>;
  firedPickups: Set<string>; // item ids fired on this visit
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
  screen: Screen;
  reading: Reading;
  bag: string[];
  justPicked: string | null; // for the bag animation
  puzzle: PuzzleState | null;
  debug: DebugInfo;
  debugPanel: boolean;
};

export type Action =
  | { type: "START" }
  | { type: "HEARD"; tokens: string[]; isFinal: boolean }
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
  | { type: "DEBUG_ADVANCE" };

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

export function enterPassage(chapter: Chapter, passageId: string): Reading {
  const passage: Passage = chapter.passages[passageId];
  const words = splitWords(passage.text);
  const tokens = buildTokens(words, {
    tolerant: chapter.tolerantTokens,
    gateWords: (passage.pickups ?? []).map((p) => p.match),
  });
  return {
    passageId,
    words,
    tokens,
    cursor: 0,
    matched: new Set(),
    firedPickups: new Set(),
    complete: tokens.length === 0,
    silenceMs: 0,
    gateStall: null,
  };
}

export function initialState(chapter: Chapter, debugPanel = false): State {
  return {
    chapter,
    screen: "title",
    reading: enterPassage(chapter, chapter.start),
    bag: [],
    justPicked: null,
    puzzle: null,
    debug: { lastAlignment: null, pickupLog: [], events: [] },
    debugPanel,
  };
}

function log(d: DebugInfo, line: string): DebugInfo {
  const stamp = new Date().toISOString().slice(11, 19);
  return { ...d, events: [`${stamp} ${line}`, ...d.events].slice(0, 60) };
}

/** What comes after a finished passage. */
function afterPassage(state: State): State {
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
    reading: enterPassage(state.chapter, passageId),
    debug: log(state.debug, `→ passage ${passageId}`),
  };
}

function applyHeard(state: State, tokens: string[], isFinal: boolean): State {
  if (state.screen !== "passage" || tokens.length === 0) return state;
  const r = state.reading;
  if (r.complete) return state;

  const result = align(r.tokens, r.cursor, tokens, {
    ...DEFAULT_ALIGN,
    gateSimilarity: gateThreshold(r.gateStall),
  });

  const matched = new Set(r.matched);
  result.matched.forEach((m) => matched.add(m));

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

  // Pickups: fire for gate tokens matched in this call, once per visit.
  const passage = state.chapter.passages[r.passageId];
  let bag = state.bag;
  let justPicked = state.justPicked;
  const fired = new Set(r.firedPickups);
  let debug: DebugInfo = { ...state.debug, lastAlignment: result };
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

  const complete = isComplete(r.tokens, result.cursor, 0);
  return {
    ...state,
    bag,
    justPicked,
    debug,
    reading: {
      ...r,
      cursor: Math.max(r.cursor, result.cursor),
      matched,
      firedPickups: fired,
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
      return applyHeard(state, action.tokens, action.isFinal);

    case "DEBUG_ADVANCE": {
      const r = state.reading;
      if (state.screen !== "passage" || r.cursor >= r.tokens.length) return state;
      return applyHeard(state, [r.tokens[r.cursor].norm], true);
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
      return { ...initialState(state.chapter, state.debugPanel), debug: log(state.debug, "restart") };

    case "TOGGLE_DEBUG":
      return { ...state, debugPanel: !state.debugPanel };
  }
}
