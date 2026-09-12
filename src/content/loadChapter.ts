import { ChapterSchema, type Chapter } from "./schema";

// Every JSON in content/ is a candidate. Pick by ?chapter=<file stem>; default chapter-01.
const files = import.meta.glob("../../content/*.json", { eager: true, import: "default" }) as Record<string, unknown>;

const stemOf = (k: string) => k.replace(/^.*\//, "").replace(/\.json$/, "");

export function listChapters(): string[] {
  return Object.keys(files).map(stemOf).sort();
}

export type ChapterSummary = { stem: string; title: string; series: string; readingLevel?: string; coverScene: string; ok: boolean };

/** Lightweight entries for the library screen. */
export function chapterSummaries(): ChapterSummary[] {
  return listChapters().map((stem) => {
    const r = loadChapter(stem);
    if ("error" in r) return { stem, title: stem, series: "", coverScene: "", ok: false };
    const ch = r.chapter;
    return { stem, title: ch.title, series: ch.series, readingLevel: ch.readingLevel, coverScene: ch.passages[ch.start].scene, ok: true };
  });
}

export function loadChapter(stem = "chapter-01"): { chapter: Chapter; stem: string } | { error: string } {
  const key = Object.keys(files).find((k) => k.endsWith(`/${stem}.json`));
  if (!key) return { error: `No content/${stem}.json. Available: ${listChapters().join(", ")}` };
  const parsed = ChapterSchema.safeParse(files[key]);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n") };
  }
  return { chapter: parsed.data, stem };
}
