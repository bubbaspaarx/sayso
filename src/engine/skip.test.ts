import { describe, expect, it } from "vitest";
import { ChapterSchema } from "../content/schema";
import { enterPassage, initialState, reducer, type State } from "./story";
import raw from "../../content/chapter-01.json";

const chapter = ChapterSchema.parse(raw);
const say = (s: State, words: string, at = 0) => reducer(s, { type: "HEARD", tokens: words.split(" "), isFinal: true, at });
const idx = (s: State, w: string, nth = 0) => s.reading.tokens.filter((t) => t.norm === w)[nth].index;

describe("provisional skips", () => {
  it("one word matched via a skip does not move the cursor until the next word agrees", () => {
    let s = reducer(initialState(chapter), { type: "START" });
    s = say(s, "nell woke up in the middle of the night something");
    const c = s.reading.cursor; // at "was"
    s = say(s, "wrong"); // skips "was" — provisional
    expect(s.reading.cursor).toBe(c);
    expect(s.reading.matched.has(idx(s, "wrong"))).toBe(false);
    expect(s.reading.provisional?.index).toBe(idx(s, "wrong"));
    s = say(s, "the garden"); // confirms
    expect(s.reading.matched.has(idx(s, "wrong"))).toBe(true);
    expect(s.reading.skipped.has(idx(s, "was"))).toBe(true);
    expect(s.reading.cursor).toBe(idx(s, "garden") + 1);
  });

  it("a skip followed by a matching word in the same batch commits immediately", () => {
    let s = reducer(initialState(chapter), { type: "START" });
    s = say(s, "nell woke up in the middle of the night something wrong the garden");
    expect(s.reading.cursor).toBe(idx(s, "garden") + 1);
    expect(s.reading.provisional).toBeNull();
  });

  it("an unconfirmed skip is dropped when the next words do not follow it", () => {
    let s = reducer(initialState(chapter), { type: "START" });
    s = say(s, "nell woke up in the middle of the night something");
    const c = s.reading.cursor;
    s = say(s, "wrong"); // provisional
    s = say(s, "banana potato"); // noise
    expect(s.reading.provisional).toBeNull();
    expect(s.reading.cursor).toBe(c);
    expect(s.reading.matched.has(idx(s, "wrong"))).toBe(false);
  });

  it("a pickup word matched via a skip still fires immediately", () => {
    let s = reducer(initialState(chapter), { type: "START" });
    s = say(s, "nell woke up in the middle of the night something was wrong the garden was dark it was never dark every night the greenhouse glowed blue at the bottom of the garden that was felix tonight the glow was gone nell jumped out of bed and pulled on her");
    s = say(s, "boots"); // exact next: fine
    expect(s.bag).toEqual(["boots"]);
  });
});

describe("re-read detection", () => {
  it("reading back over the previous sentence does not advance the cursor", () => {
    let s = reducer(initialState(chapter), { type: "START" });
    s = say(s, "nell woke up in the middle of the night something was wrong");
    const c = s.reading.cursor; // at "the" (garden)
    s = say(s, "in the middle of the night"); // re-read; "the" would otherwise match ahead
    expect(s.reading.cursor).toBe(c);
    s = say(s, "the garden was dark");
    expect(s.reading.cursor).toBe(idx(s, "dark") + 1);
  });
});

describe("cues", () => {
  it("reading a cue word flashes the item without collecting it", () => {
    let s = reducer(initialState(chapter), { type: "START" });
    s = { ...s, reading: enterPassage(chapter, "p3") };
    s = say(s, "felix needs three things when he is cold said grandma fen a lantern", 1000);
    expect(s.reading.cues.map((c) => c.itemId)).toEqual(["lantern"]);
    expect(s.bag).toEqual([]);
    s = reducer(s, { type: "CUE_EXPIRE", now: 5000 });
    expect(s.reading.cues).toEqual([]);
  });
});
