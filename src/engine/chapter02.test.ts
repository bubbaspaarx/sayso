import { describe, expect, it } from "vitest";
import { ChapterSchema } from "../content/schema";
import { initialState, reducer, type State } from "./story";
import raw from "../../content/chapter-02.json";

const chapter = ChapterSchema.parse(raw);
const readAll = (s: State) => { while (!s.reading.complete) s = reducer(s, { type: "DEBUG_ADVANCE" }); return s; };

describe("chapter-02 (Coral and the Bubble Party)", () => {
  it("validates, with media prompts for every scene", () => {
    expect(chapter.media?.scenes[chapter.passages.p1.scene]).toBeDefined();
    expect(chapter.media?.scenes["ship-party"]?.editOf).toBe("ship-door");
  });

  it("runs end to end with the same engine: pickups, cues, choice loop, puzzle, end", () => {
    let s = reducer(initialState(chapter, false, "chapter-02"), { type: "START" });
    const visited: string[] = [];
    while (s.screen === "passage") {
      visited.push(s.reading.passageId);
      s = readAll(s);
      s = reducer(s, { type: "NEXT" });
    }
    expect(visited).toEqual(["p1", "p2", "p3", "p4", "p5", "p6", "p7"]);
    expect(s.bag).toEqual(["pearl", "crab", "shell", "starfish"]);
    expect(s.screen).toBe("choice");
    s = reducer(s, { type: "CHOOSE", next: "p8a" });
    s = readAll(s); s = reducer(s, { type: "NEXT" });
    expect(s.reading.passageId).toBe("p7");
    s = readAll(s); s = reducer(s, { type: "NEXT" });
    s = reducer(s, { type: "CHOOSE", next: "p8b" });
    s = readAll(s); s = reducer(s, { type: "NEXT" });
    expect(s.bag).toContain("seaweed");
    s = readAll(s); s = reducer(s, { type: "NEXT" });
    expect(s.screen).toBe("puzzle");
    for (const id of ["crab", "seaweed", "pearl"]) s = reducer(s, { type: "PUZZLE_TOGGLE", itemId: id });
    s = reducer(s, { type: "PUZZLE_TRY" });
    expect(s.puzzle?.feedback).toContain("Granny Tide");
    for (const id of ["starfish", "pearl", "shell"]) s = reducer(s, { type: "PUZZLE_TOGGLE", itemId: id });
    s = reducer(s, { type: "PUZZLE_TRY" });
    expect(s.puzzle?.success).toBe(true);
    s = reducer(s, { type: "PUZZLE_CONTINUE" });
    s = readAll(s); s = reducer(s, { type: "NEXT" });
    s = readAll(s); s = reducer(s, { type: "NEXT" });
    expect(s.screen).toBe("end");
  });

  it("Granny Tide's words cue the three items without collecting them", () => {
    let s = reducer(initialState(chapter, false, "chapter-02"), { type: "START" });
    s = readAll(s); s = reducer(s, { type: "NEXT" });
    expect(s.reading.passageId).toBe("p2");
    s = readAll(s);
    expect(s.reading.cues.map((c) => c.itemId)).toEqual(["pearl", "shell", "starfish"]);
    expect(s.bag).toEqual(["pearl"]);
  });
});
