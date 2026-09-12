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
  /** Reading `match` flashes the item briefly above the text. Not collected. */
  cues: z.array(z.object({ itemId: z.string(), match: z.string() })).optional(),
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

export const SceneMediaSchema = z.object({
  still: z.string(),
  motion: z.string(),
  editOf: z.string().optional(), // generate as an edit of this scene's chosen still
});

export const MediaSchema = z.object({
  stylePrefix: z.string(),
  motionSuffix: z.string(),
  anchor: z.string().optional(), // scene generated first; its still becomes the style reference
  scenes: z.record(SceneMediaSchema),
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
    media: MediaSchema.optional(),
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
      for (const [kind, list] of [["pickups", p.pickups], ["cues", p.cues]] as const) {
        for (const pk of list ?? []) {
          if (!itemIds.has(pk.itemId))
            ctx.addIssue({ code: "custom", message: `passages.${pid}.${kind}: unknown item "${pk.itemId}"` });
          if (!p.text.toLowerCase().includes(pk.match.toLowerCase()))
            ctx.addIssue({ code: "custom", message: `passages.${pid}.${kind}: match "${pk.match}" not found in text` });
        }
      }
    }
    if (ch.media) {
      const used = new Set(Object.values(ch.passages).map((p) => p.scene));
      for (const sc of used)
        if (!ch.media.scenes[sc]) ctx.addIssue({ code: "custom", message: `media.scenes: no prompts for scene "${sc}"` });
      for (const [sid, sc] of Object.entries(ch.media.scenes))
        if (sc.editOf && !ch.media.scenes[sc.editOf])
          ctx.addIssue({ code: "custom", message: `media.scenes.${sid}.editOf: unknown scene "${sc.editOf}"` });
      if (ch.media.anchor && !ch.media.scenes[ch.media.anchor])
        ctx.addIssue({ code: "custom", message: `media.anchor: unknown scene "${ch.media.anchor}"` });
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
export type ChapterMedia = z.infer<typeof MediaSchema>;
