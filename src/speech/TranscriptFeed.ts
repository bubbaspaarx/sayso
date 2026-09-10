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
  private timer: number | null = null;
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
    this.prevAll = all;
    if (fresh.length === 0 && !t.isFinal) return;

    this.pending.push(...fresh);
    this.pendingFinal = this.pendingFinal || t.isFinal;
    if (t.isFinal) this.flush();
    else if (this.timer === null) this.timer = window.setTimeout(() => this.flush(), this.debounceMs);
  }

  private flush() {
    if (this.timer !== null) window.clearTimeout(this.timer);
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
