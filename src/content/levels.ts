import { BANDS, YEARS, type Band, type Chapter, type Level, type Year } from "./schema";

export type Profile = { year: Year; band: Band };
export const DEFAULT_PROFILE: Profile = { year: "1", band: "secure" };
const KEY = "sayso.profile";

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Profile>;
      if (p.year && YEARS.includes(p.year) && p.band && BANDS.includes(p.band)) return { year: p.year, band: p.band };
    }
  } catch { /* storage unavailable */ }
  return DEFAULT_PROFILE;
}

export function saveProfile(p: Profile) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export const yearIndex = (y: Year) => YEARS.indexOf(y);
export const bandIndex = (b: Band) => BANDS.indexOf(b);
export const yearLabel = (y: Year) => (y === "R" ? "Reception" : `Year ${y}`);
export const bandLabel = (b: Band) => b[0].toUpperCase() + b.slice(1);

export type LevelEntry = { id: string; level: Level };

export function levelsOf(chapter: Chapter): LevelEntry[] {
  return Object.entries(chapter.levels ?? {}).map(([id, level]) => ({ id, level }));
}

/** The level a book should open at for this profile: exact match, else nearest band in the same year, else nearest year. */
export function pickLevel(chapter: Chapter, profile: Profile): LevelEntry | null {
  const all = levelsOf(chapter);
  if (!all.length) return null;
  const score = (e: LevelEntry) =>
    Math.abs(yearIndex(e.level.year) - yearIndex(profile.year)) * 10 + Math.abs(bandIndex(e.level.band) - bandIndex(profile.band));
  const sorted = [...all].sort((a, b) => score(a) - score(b));
  if (score(sorted[0]) === 0) return sorted[0];
  if (chapter.defaultLevel && score(sorted[0]) >= 10 && chapter.levels?.[chapter.defaultLevel]) {
    // A different year entirely: prefer the book's own default over a far stretch.
    return { id: chapter.defaultLevel, level: chapter.levels[chapter.defaultLevel] };
  }
  return sorted[0];
}

export function levelText(chapter: Chapter, levelId: string | null, passageId: string): { text: string; narration?: string } {
  const base = chapter.passages[passageId].text;
  const ov = levelId ? chapter.levels?.[levelId]?.passages?.[passageId] : undefined;
  return { text: ov?.text ?? base, narration: ov?.narration };
}
