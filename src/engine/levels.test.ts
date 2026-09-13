import { describe, expect, it } from "vitest";
import { ChapterSchema } from "../content/schema";
import { levelText, levelsOf, pickLevel } from "../content/levels";
import { initialState, reducer, type State } from "./story";
import raw2 from "../../content/chapter-02.json";
import raw1 from "../../content/chapter-01.json";

const coral = ChapterSchema.parse(raw2);
const nell = ChapterSchema.parse(raw1);
const readAll = (s: State) => { while (!s.reading.complete) s = reducer(s, { type: "DEBUG_ADVANCE" }); return s; };

describe("reading levels", () => {
  it("chapter 2 offers Year 1 at three bands; chapter 1 one level", () => {
    expect(levelsOf(coral).map((e) => e.id)).toEqual(["y1-beginner", "y1-secure", "y1-advanced"]);
    expect(levelsOf(nell).map((e) => e.id)).toEqual(["y2-secure"]);
  });

  it("picks the exact level, then nearest band, then the book's default for a far year", () => {
    expect(pickLevel(coral, { year: "1", band: "beginner" })?.id).toBe("y1-beginner");
    expect(pickLevel(coral, { year: "1", band: "advanced" })?.id).toBe("y1-advanced");
    expect(pickLevel(nell, { year: "2", band: "beginner" })?.id).toBe("y2-secure"); // nearest band in the year
    expect(pickLevel(nell, { year: "R", band: "beginner" })?.id).toBe("y2-secure"); // far year → default
    expect(pickLevel(coral, { year: "4", band: "advanced" })?.id).toBe("y1-secure"); // far year → default
  });

  it("beginner text swaps the child's line and adds a grown-up line; secure keeps the base text", () => {
    const b = levelText(coral, "y1-beginner", "p1");
    expect(b.text).toBe('Splash can swim. Splash got a pearl. "Ooh!" said Splash.');
    expect(b.narration).toContain("Coral was a mermaid");
    const s = levelText(coral, "y1-secure", "p1");
    expect(s.text).toBe(coral.passages.p1.text);
    expect(s.narration).toBeUndefined();
  });

  it("every level keeps every pickup and cue word (validator) and the whole story still runs", () => {
    for (const { id } of levelsOf(coral)) {
      let s = reducer(initialState(coral, false, "chapter-02", id), { type: "START" });
      while (s.screen === "passage") { s = readAll(s); s = reducer(s, { type: "NEXT" }); }
      expect(s.bag).toEqual(["pearl", "crab", "shell", "starfish"]);
      expect(s.screen).toBe("choice");
    }
  });

  it("beginner passages are short", () => {
    const words = Object.keys(coral.passages).map((pid) => levelText(coral, "y1-beginner", pid).text.split(" ").length);
    expect(Math.max(...words)).toBeLessThanOrEqual(16);
  });

  it("restart keeps the level", () => {
    let s = reducer(initialState(coral, false, "chapter-02", "y1-beginner"), { type: "START" });
    s = reducer(s, { type: "RESTART" });
    expect(s.levelId).toBe("y1-beginner");
    expect(s.reading.narration).toBeDefined();
  });
});
