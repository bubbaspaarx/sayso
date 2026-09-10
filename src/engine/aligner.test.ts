import { describe, expect, it } from "vitest";
import { align, isComplete, DEFAULT_ALIGN, similarity } from "./aligner";
import { buildTokens, splitWords, tokeniseTranscript } from "./tokenise";

function expected(text: string, gates: string[] = [], tolerant: string[] = []) {
  return buildTokens(splitWords(text), { gateWords: gates, tolerant });
}

/** Feed transcript chunks one after another, like a live session. */
function read(text: string, chunks: string[], gates: string[] = [], tolerant: string[] = []) {
  const exp = expected(text, gates, tolerant);
  let cursor = 0;
  const matched = new Set<number>();
  let last = align(exp, 0, []);
  for (const c of chunks) {
    last = align(exp, cursor, tokeniseTranscript(c));
    cursor = last.cursor;
    last.matched.forEach((m) => matched.add(m));
  }
  return { exp, cursor, matched, last };
}

const P5 =
  'Nell ran to the kitchen. On the table was a torch. On the hook was a key. Nell looked. Then she saw it, by the door. The old yellow lantern. She picked it up. It was heavy and warm. "One," said Nell.';
const P5_GATES = ["torch", "key", "lantern"];

describe("tokenise", () => {
  it("strips punctuation, keeps inner apostrophes, lowercases", () => {
    expect(tokeniseTranscript(`"Grandma!" Felix's I'm CAW!`)).toEqual(["grandma", "felix's", "i'm", "caw"]);
  });
  it("merges known compounds", () => {
    expect(tokeniseTranscript("the green house glowed")).toEqual(["the", "greenhouse", "glowed"]);
  });
  it("marks first pickup occurrence as gate and short words as soft", () => {
    const exp = expected("A lantern. A blanket. The lantern.", ["lantern"]);
    expect(exp[1].gate).toBe(true);
    expect(exp[5].gate).toBe(false);
    expect(exp[0].soft).toBe(true);
    expect(exp[1].soft).toBe(false);
  });
});

describe("aligner", () => {
  it("exact read reaches the end", () => {
    const r = read(P5, [P5], P5_GATES);
    expect(r.cursor).toBe(r.exp.length);
    expect(r.matched.size).toBe(r.exp.length);
  });

  it("exact read in interim chunks", () => {
    const r = read(P5, ["nell ran", "to the kitchen on", "the table was a torch on the hook was a key"], P5_GATES);
    expect(r.exp[r.cursor - 1].norm).toBe("key");
  });

  it("one skipped ordinary word mid-sentence still advances", () => {
    const r = read("Something was wrong. The garden was dark.", ["something wrong the garden was dark"]);
    expect(r.cursor).toBe(r.exp.length);
    expect(r.matched.has(1)).toBe(false); // "was" skipped, not matched
  });

  it("does not skip more than two consecutive hard words", () => {
    const r = read("one two three four five six seven", ["one seven"]);
    expect(r.cursor).toBe(1);
  });

  it("child repeats a sentence: cursor holds, never goes back", () => {
    const text = "Nell woke up in the middle of the night. Something was wrong.";
    const r = read(text, ["nell woke up in the middle of the night", "in the middle of the night", "something was wrong"]);
    expect(r.cursor).toBe(r.exp.length);
    const after = align(r.exp, 9, tokeniseTranscript("in the middle of the night"));
    expect(after.cursor).toBe(9);
  });

  it("ASR mishears an ordinary word: skipped, reading continues", () => {
    const r = read("The old yellow lantern sat there.", ["the old yellow landed sat there"]);
    expect(r.cursor).toBe(r.exp.length);
  });

  it("gate: cursor parks on a mumbled pickup word and blocks", () => {
    const r = read(P5, ["nell ran to the kitchen on the table was a landed on the hook"], P5_GATES);
    const torchIdx = r.exp.findIndex((t) => t.norm === "torch");
    expect(r.cursor).toBe(torchIdx);
    expect(r.last.blockedByGate).toBe(torchIdx);
    expect(r.matched.has(torchIdx)).toBe(false);
  });

  it("gate: saying the word again releases it", () => {
    const r = read(P5, ["nell ran to the kitchen on the table was a landed on the hook", "torch on the hook was a key"], P5_GATES);
    const keyIdx = r.exp.findIndex((t) => t.norm === "key");
    expect(r.cursor).toBe(keyIdx + 1);
    expect(r.matched.has(r.exp.findIndex((t) => t.norm === "torch"))).toBe(true);
    expect(r.matched.has(keyIdx)).toBe(true);
  });

  it("gate: loosened threshold accepts a near miss after stall", () => {
    const exp = expected("the old yellow lantern by the door", ["lantern"]);
    const strict = align(exp, 0, ["the", "old", "yellow", "landed"]);
    expect(strict.cursor).toBe(3);
    const loose = align(exp, 3, ["landed", "by", "the"], { ...DEFAULT_ALIGN, gateSimilarity: 0.5 });
    expect(loose.matched).toContain(3);
    expect(loose.cursor).toBe(6);
  });

  it("long silence then continues", () => {
    const r = read("Nell nodded. Lantern. Blanket. Song.", ["nell nodded", "", "", "lantern blanket song"]);
    expect(r.cursor).toBe(r.exp.length);
  });

  it("Luminis Radix mangled completely is skipped for free", () => {
    const text = '"A Luminis Radix must never get cold. Listen to me, Nell."';
    const r = read(text, ["a loomy rad must never get cold listen to me nell"], [], ["luminis", "radix"]);
    expect(r.cursor).toBe(r.exp.length);
  });

  it("homophones via confusion table", () => {
    const r = read("Nell went to the pond.", ["now went two the pound"]);
    expect(r.cursor).toBe(r.exp.length);
  });

  it("plural tolerance", () => {
    expect(similarity("torch", "torches")).toBeLessThan(0.75);
    const r = read("Nell's boots were by the door.", ["nell's boot were by the door"]);
    expect(r.cursor).toBe(r.exp.length);
  });
});

describe("completion", () => {
  const exp = expected("She held it tight. Two, said Nell.");
  it("complete at length-1", () => {
    expect(isComplete(exp, exp.length - 1, 0)).toBe(true);
    expect(isComplete(exp, exp.length - 2, 0)).toBe(false);
  });
  it("silence valve at length-3", () => {
    expect(isComplete(exp, exp.length - 3, 3000)).toBe(true);
    expect(isComplete(exp, exp.length - 4, 3000)).toBe(false);
  });
  it("never completes past an unread gate", () => {
    const g = expected("Nell hummed the song now.", ["song"]);
    expect(isComplete(g, g.length - 2, 5000)).toBe(false);
  });
});
