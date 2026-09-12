// Shared helpers for the media scripts. Every script takes a chapter stem (content/<stem>.json).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, parse } from "node:path";

export function chapterArg(argv) {
  const i = argv.findIndex((a) => a === "--chapter" || a === "-c");
  const stem = i >= 0 ? argv[i + 1] : "chapter-01";
  const rest = argv.filter((_, k) => i < 0 || (k !== i && k !== i + 1));
  return { stem, rest };
}

export function loadChapter(stem) {
  const file = `content/${stem}.json`;
  if (!existsSync(file)) throw new Error(`no ${file}`);
  const ch = JSON.parse(readFileSync(file, "utf8"));
  if (!ch.media) throw new Error(`${file} has no "media" block (stylePrefix, motionSuffix, scenes)`);
  const used = [...new Set(Object.values(ch.passages).map((p) => p.scene))];
  // Anchor first, then edits last (they need their source still).
  const order = used
    .filter((s) => s !== ch.media.anchor)
    .sort((a, b) => (ch.media.scenes[a]?.editOf ? 1 : 0) - (ch.media.scenes[b]?.editOf ? 1 : 0));
  const scenes = ch.media.anchor ? [ch.media.anchor, ...order] : order;
  return { ch, scenes, dirs: {
    stills: `media-src/${stem}/stills`, candidates: `media-src/${stem}/candidates`, clips: `media-src/${stem}/clips`,
    ref: `media-src/${stem}/ref`, out: `public/media/${stem}` } };
}

export function loadKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  if (existsSync(".env")) {
    const m = readFileSync(".env", "utf8").match(/^OPENROUTER_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

export const findFile = (dir, stem, exts = /\.(png|jpe?g|webp)$/i) => {
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).find((n) => parse(n).name === stem && exts.test(n));
  return f ? join(dir, f) : null;
};

export const toDataUrl = (file) => {
  const ext = parse(file).ext.slice(1).toLowerCase();
  return `data:image/${ext === "jpg" ? "jpeg" : ext};base64,${readFileSync(file).toString("base64")}`;
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
