import { describe, expect, it } from "vitest";
import { TranscriptFeed } from "./TranscriptFeed";

function feed() {
  const out: string[][] = [];
  const f = new TranscriptFeed((t) => out.push(t), 0);
  return { f, out };
}

describe("TranscriptFeed", () => {
  it("feeds interim growth once", () => {
    const { f, out } = feed();
    f.push({ text: "nell ran", isFinal: false });
    f.push({ text: "nell ran to the", isFinal: false });
    f.push({ text: "nell ran to the", isFinal: true });
    expect(out).toEqual([["nell", "ran"], ["to", "the"], []]);
  });

  it("does not re-feed an interim tail after a final confirms its head (iOS)", () => {
    const { f, out } = feed();
    f.push({ text: "nell ran to the kitchen on the", isFinal: false });
    f.push({ text: "nell ran to the kitchen", isFinal: true });
    f.push({ text: "on the table", isFinal: false });
    expect(out.flat()).toEqual(["nell", "ran", "to", "the", "kitchen", "on", "the", "table"]);
  });

  it("feeds only the differing suffix when a final revises the interim", () => {
    const { f, out } = feed();
    f.push({ text: "the old yellow landed", isFinal: false });
    f.push({ text: "the old yellow lantern", isFinal: true });
    expect(out.flat()).toEqual(["the", "old", "yellow", "landed", "lantern"]);
  });
});
