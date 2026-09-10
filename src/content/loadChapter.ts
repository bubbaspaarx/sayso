import { ChapterSchema, type Chapter } from "./schema";

// Every JSON in content/ is a candidate. Pick by ?chapter=<file stem>; default chapter-01.
const files = import.meta.glob("../../content/*.json", { eager: true, import: "default" }) as Record<
  string,
  unknown
>;

export function listChapters(): string[] {
  return Object.keys(files).map((k) => k.replace(/^.*\//, "").replace(/\.json$/, ""));
}

export function loadChapter(stem = "chapter-01"): { chapter: Chapter } | { error: string } {
  const key = Object.keys(files).find((k) => k.endsWith(`/${stem}.json`));
  if (!key) return { error: `No content/${stem}.json. Available: ${listChapters().join(", ")}` };
  const parsed = ChapterSchema.safeParse(files[key]);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n") };
  }
  return { chapter: parsed.data };
}
