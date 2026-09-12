import { describe, expect, it } from "vitest";
import { ChapterSchema } from "../content/schema";
import { initialState, reducer, type State } from "./story";
import raw from "../../content/chapter-01.json";

const chapter = ChapterSchema.parse(raw);

function readAll(s: State, skipWord?: string): State {
  // Pretend to read every word (like the spacebar), optionally skipping one word.
  let st = s;
  while (!st.reading.complete) {
    const t = st.reading.tokens[st.reading.cursor];
    if (skipWord && t.norm === skipWord) {
      // Feed the following two words instead, as if mumbling past it.
      const after = st.reading.tokens.slice(st.reading.cursor + 1, st.reading.cursor + 3).map((x) => x.norm);
      const before = st.reading.cursor;
      st = reducer(st, { type: "HEARD", tokens: after, isFinal: true });
      expect(st.reading.cursor).toBe(before); // gate held
      // now say it properly
      st = reducer(st, { type: "HEARD", tokens: [t.norm], isFinal: true });
    } else {
      st = reducer(st, { type: "DEBUG_ADVANCE" });
    }
  }
  return st;
}

describe("chapter-01 validates", () => {
  it("passes the schema and cross-reference checks", () => {
    expect(chapter.id).toBe("nell-01-cold-night");
  });
});

describe("story flow", () => {
  it("runs title → passages → choice loop → puzzle → hint → end", () => {
    let s = initialState(chapter);
    expect(s.screen).toBe("title");
    s = reducer(s, { type: "START" });
    expect(s.screen).toBe("passage");
    expect(s.reading.passageId).toBe("p1");

    const visited: string[] = [];
    // p1..p7 linear
    for (let i = 0; i < 7; i++) {
      visited.push(s.reading.passageId);
      s = readAll(s);
      s = reducer(s, { type: "NEXT" });
    }
    expect(visited).toEqual(["p1", "p2", "p3", "p4", "p5", "p6", "p7"]);
    expect(s.debug.events.filter((e) => e.includes("gate stall"))).toEqual([]);
    expect(s.bag).toEqual(["boots", "torch", "key", "lantern", "blanket", "song"]);

    // p8 has a choice
    expect(s.reading.passageId).toBe("p8");
    s = readAll(s);
    s = reducer(s, { type: "NEXT" });
    expect(s.screen).toBe("choice");

    // wrong way loops back to p8
    s = reducer(s, { type: "CHOOSE", next: "p9a" });
    expect(s.reading.passageId).toBe("p9a");
    s = readAll(s);
    s = reducer(s, { type: "NEXT" });
    expect(s.reading.passageId).toBe("p8");
    s = readAll(s);
    s = reducer(s, { type: "NEXT" });
    expect(s.screen).toBe("choice");
    s = reducer(s, { type: "CHOOSE", next: "p9b" });
    expect(s.reading.passageId).toBe("p9b");
    s = readAll(s);
    s = reducer(s, { type: "NEXT" });

    // p10 → puzzle
    expect(s.reading.passageId).toBe("p10");
    s = readAll(s);
    s = reducer(s, { type: "NEXT" });
    expect(s.screen).toBe("puzzle");

    // wrong set → feedback; second wrong → hint
    for (const id of ["torch", "key", "boots"]) s = reducer(s, { type: "PUZZLE_TOGGLE", itemId: id });
    s = reducer(s, { type: "PUZZLE_TRY" });
    expect(s.screen).toBe("puzzle");
    expect(s.puzzle?.feedback).toBe(chapter.puzzles.greenhouse.wrongFeedback);
    expect(s.puzzle?.selected).toEqual([]);
    for (const id of ["torch", "blanket", "song"]) s = reducer(s, { type: "PUZZLE_TOGGLE", itemId: id });
    s = reducer(s, { type: "PUZZLE_TRY" });
    expect(s.screen).toBe("hint");
    s = reducer(s, { type: "HINT_DISMISS" });
    expect(s.screen).toBe("puzzle");

    // cannot select a 4th
    for (const id of ["song", "lantern", "blanket", "torch"]) s = reducer(s, { type: "PUZZLE_TOGGLE", itemId: id });
    expect(s.puzzle?.selected).toEqual(["song", "lantern", "blanket"]);
    s = reducer(s, { type: "PUZZLE_TRY" });
    expect(s.puzzle?.success).toBe(true);
    s = reducer(s, { type: "PUZZLE_CONTINUE" });
    expect(s.reading.passageId).toBe("p11");

    s = readAll(s);
    s = reducer(s, { type: "NEXT" });
    expect(s.reading.passageId).toBe("p12");
    s = readAll(s);
    s = reducer(s, { type: "NEXT" });
    expect(s.screen).toBe("end");

    s = reducer(s, { type: "RESTART" });
    expect(s.screen).toBe("title");
    expect(s.bag).toEqual([]);
  });

  it("mumbling past lantern holds the cursor; saying it fires the pickup once", () => {
    let s = reducer(initialState(chapter), { type: "START" });
    for (let i = 0; i < 4; i++) {
      s = readAll(s);
      s = reducer(s, { type: "NEXT" });
    }
    expect(s.reading.passageId).toBe("p5");
    s = readAll(s, "lantern");
    expect(s.bag).toContain("lantern");
    expect(s.debug.events.filter((e) => e.includes('gate stall on "lantern" attempt 1')).length).toBe(1);
    expect(s.debug.pickupLog.filter((l) => l.startsWith("lantern")).length).toBe(1);
  });

  it("the word 'lantern' in p3 does not collect the lantern", () => {
    let s = reducer(initialState(chapter), { type: "START" });
    for (let i = 0; i < 2; i++) {
      s = readAll(s);
      s = reducer(s, { type: "NEXT" });
    }
    expect(s.reading.passageId).toBe("p3");
    s = readAll(s);
    expect(s.bag).toEqual(["boots"]); // boots from p1 only — no lantern from Grandma's words
  });

  it("silence valve completes a passage with 2 trailing words unheard", () => {
    let s = reducer(initialState(chapter), { type: "START" });
    s = readAll(s);
    s = reducer(s, { type: "NEXT" }); // p2 has no pickup gates at its tail
    const n = s.reading.tokens.length;
    while (s.reading.cursor < n - 2) s = reducer(s, { type: "DEBUG_ADVANCE" });
    expect(s.reading.complete).toBe(false);
    s = reducer(s, { type: "SILENCE", ms: 2500 });
    expect(s.reading.complete).toBe(true);
  });
});
