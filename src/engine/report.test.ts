import { describe, expect, it } from "vitest";
import { ChapterSchema } from "../content/schema";
import { initialState, reducer, type State } from "./story";
import { buildReport } from "./report";
import raw from "../../content/chapter-01.json";

const chapter = ChapterSchema.parse(raw);

function say(s: State, words: string, at: number): State {
  return reducer(s, { type: "HEARD", tokens: words.split(" "), isFinal: true, at });
}

describe("skipped words, recovery, and the report", () => {
  it("marks a passed-over word as skipped and shows it in the report", () => {
    let s = reducer(initialState(chapter), { type: "START" }); // p1: "Nell woke up in the middle of the night. Something was wrong..."
    s = say(s, "nell woke up in the middle of the night something wrong", 1000);
    const wasIdx = s.reading.tokens.findIndex((t) => t.norm === "was");
    expect(s.reading.skipped.has(wasIdx)).toBe(true);
    expect(s.reading.matched.has(wasIdx)).toBe(false);
  });

  it("a corrected re-read recovers the skipped word without moving the cursor", () => {
    let s = reducer(initialState(chapter), { type: "START" });
    s = say(s, "nell woke up in the middle of the night something wrong", 1000);
    const cursor = s.reading.cursor;
    s = say(s, "was", 1800); // adult: "look again — 'was'"; child repeats it
    const wasIdx = s.reading.tokens.findIndex((t) => t.norm === "was");
    expect(s.reading.recovered.has(wasIdx)).toBe(true);
    expect(s.reading.matched.has(wasIdx)).toBe(true);
    expect(s.reading.cursor).toBe(cursor);
  });

  it("builds a report with accuracy, practice words and full-stop pauses", () => {
    let s = reducer(initialState(chapter), { type: "START" });
    const toks = s.reading.tokens.map((t) => t.norm);
    const display = s.reading.tokens.map((t) => s.reading.words[t.wordIndex].text);
    // Read p1 one word at a time: 300ms between words, 900ms after every full stop, skipping "was".
    const skipAt = toks.indexOf("was");
    let t = 0;
    for (let i = 0; i < toks.length; i++) {
      if (i === skipAt) continue;
      t += /[.!?]$/.test(display[i - 1] ?? "") ? 900 : 300;
      s = say(s, toks[i], t);
    }
    s = reducer(s, { type: "NEXT" });
    expect(s.history.length).toBe(1);
    const r = buildReport(s.history, chapter);
    expect(r.skipped).toBe(1);
    expect(r.practice.map((p) => p.word)).toEqual(["was"]);
    expect(r.heard).toBe(toks.length - 1);
    expect(r.accuracy).toBeCloseTo((toks.length - 1) / toks.length, 3);
    expect(r.fullStops.measured).toBeGreaterThan(0);
    expect(r.fullStops.paused).toBe(r.fullStops.measured);
  });

  it("reads through full stops → paused count is zero", () => {
    let s = reducer(initialState(chapter), { type: "START" });
    const toks = s.reading.tokens.map((t) => t.norm);
    let t = 0;
    for (const w of toks) s = say(s, w, (t += 300));
    s = reducer(s, { type: "NEXT" });
    const r = buildReport(s.history, chapter);
    expect(r.fullStops.paused).toBe(0);
    expect(r.fullStops.measured).toBeGreaterThan(0);
  });

  it("report screen opens from the end screen and restart clears history", () => {
    let s = reducer(initialState(chapter), { type: "START" });
    s = { ...s, screen: "end" };
    s = reducer(s, { type: "REPORT_OPEN" });
    expect(s.screen).toBe("report");
    s = reducer(s, { type: "REPORT_CLOSE" });
    expect(s.screen).toBe("end");
    s = reducer(s, { type: "RESTART" });
    expect(s.history).toEqual([]);
  });
});
