import { tokeniseTranscript } from "../engine/tokenise";
import type { Transcript } from "./SpeechSource";

/**
 * Turns a stream of final/interim transcripts into "newly heard tokens".
 * Everything seen is consumed; interim rewrites are diffed by common prefix.
 * Emits are debounced ~100ms (finals flush immediately) to avoid interim jitter.
 */
export class TranscriptFeed {
  private finalTokens: string[] = [];
  private interimTokens: string[] = [];
  private prevAll: string[] = [];
  private pending: string[] = [];
  private pendingFinal = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  finalText = "";
  interimText = "";

  constructor(
    private emit: (tokens: string[], isFinal: boolean) => void,
    private debounceMs = 100,
  ) {}

  push(t: Transcript) {
    const toks = tokeniseTranscript(t.text);
    if (t.isFinal) {
      this.finalTokens.push(...toks);
      this.interimTokens = [];
      this.finalText = (this.finalText + " " + t.text).trim().slice(-2000);
      this.interimText = "";
    } else {
      this.interimTokens = toks;
      this.interimText = t.text;
    }
    const all = [...this.finalTokens, ...this.interimTokens];
    // Longest common prefix with what we've already fed.
    let lcp = 0;
    while (lcp < all.length && lcp < this.prevAll.length && all[lcp] === this.prevAll[lcp]) lcp++;
    const fresh = all.slice(lcp).slice(-12);
    // A final that merely confirms the head of an interim we already fed must NOT
    // shrink our memory, or the tail of that interim gets fed twice on the next event
    // (that re-feed is what made the cursor hop into the next sentence on iOS).
    const isPrefixOfFed = lcp === all.length && all.length <= this.prevAll.length;
    if (!isPrefixOfFed) this.prevAll = all;
    if (fresh.length === 0 && !t.isFinal) return;

    this.pending.push(...fresh);
    this.pendingFinal = this.pendingFinal || t.isFinal;
    if (t.isFinal || this.debounceMs <= 0) this.flush();
    else if (this.timer === null) this.timer = setTimeout(() => this.flush(), this.debounceMs);
  }

  private flush() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    const toks = this.pending;
    const isFinal = this.pendingFinal;
    this.pending = [];
    this.pendingFinal = false;
    this.emit(toks, isFinal);
  }

  reset() {
    this.finalTokens = [];
    this.interimTokens = [];
    this.prevAll = [];
    this.pending = [];
    this.finalText = "";
    this.interimText = "";
  }
}
