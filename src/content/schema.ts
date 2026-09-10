import { z } from "zod";

export const ItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  emoji: z.string(),
});

export const PassageSchema = z.object({
  scene: z.string(),
  text: z.string(),
  pickups: z.array(z.object({ itemId: z.string(), match: z.string() })).optional(),
  next: z.string().optional(),
  choice: z
    .object({
      prompt: z.string(),
      options: z.array(z.object({ label: z.string(), next: z.string() })).min(2),
    })
    .optional(),
  puzzle: z.string().optional(),
});

export const PuzzleSchema = z.object({
  id: z.string(),
  type: z.literal("pick-set"),
  prompt: z.string(),
  correct: z.array(z.string()).min(1),
  pickCount: z.number().int().positive(),
  onSuccess: z.string(),
  hintAfterAttempts: z.number().int().positive(),
  hintPassage: z.string(),
  wrongFeedback: z.string(),
});

export const ChapterSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    series: z.string(),
    readingLevel: z.string().optional(),
    start: z.string(),
    items: z.array(ItemSchema),
    passages: z.record(PassageSchema),
    puzzles: z.record(PuzzleSchema),
    tolerantTokens: z.array(z.string()).optional(),
  })
  .superRefine((ch, ctx) => {
    const itemIds = new Set(ch.items.map((i) => i.id));
    const passageIds = new Set(Object.keys(ch.passages));
    const puzzleIds = new Set(Object.keys(ch.puzzles));
    const needPassage = (id: string, where: string) => {
      if (!passageIds.has(id)) ctx.addIssue({ code: "custom", message: `${where}: unknown passage "${id}"` });
    };
    needPassage(ch.start, "start");
    for (const [pid, p] of Object.entries(ch.passages)) {
      if (p.next) needPassage(p.next, `passages.${pid}.next`);
      if (p.choice) for (const o of p.choice.options) needPassage(o.next, `passages.${pid}.choice`);
      if (p.puzzle && !puzzleIds.has(p.puzzle))
        ctx.addIssue({ code: "custom", message: `passages.${pid}.puzzle: unknown puzzle "${p.puzzle}"` });
      for (const pk of p.pickups ?? []) {
        if (!itemIds.has(pk.itemId))
          ctx.addIssue({ code: "custom", message: `passages.${pid}.pickups: unknown item "${pk.itemId}"` });
        if (!p.text.toLowerCase().includes(pk.match.toLowerCase()))
          ctx.addIssue({ code: "custom", message: `passages.${pid}.pickups: match "${pk.match}" not found in text` });
      }
    }
    for (const [qid, q] of Object.entries(ch.puzzles)) {
      needPassage(q.onSuccess, `puzzles.${qid}.onSuccess`);
      needPassage(q.hintPassage, `puzzles.${qid}.hintPassage`);
      for (const c of q.correct)
        if (!itemIds.has(c)) ctx.addIssue({ code: "custom", message: `puzzles.${qid}.correct: unknown item "${c}"` });
      if (q.correct.length !== q.pickCount)
        ctx.addIssue({ code: "custom", message: `puzzles.${qid}: pickCount must equal correct.length` });
    }
  });

export type Chapter = z.infer<typeof ChapterSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type Passage = z.infer<typeof PassageSchema>;
export type Puzzle = z.infer<typeof PuzzleSchema>;
