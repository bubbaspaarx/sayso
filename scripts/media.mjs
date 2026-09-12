// media-src/<chapter>/{stills,clips}/<scene>.* → public/media/<chapter>/<scene>.{jpg,mp4}
//   npm run media -- --chapter chapter-02            all scenes
//   npm run media -- --chapter chapter-02 rock-pool  one scene
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { chapterArg, findFile, loadChapter } from "./lib.mjs";

const { stem, rest } = chapterArg(process.argv.slice(2));
const [only] = rest;
const { scenes, dirs } = loadChapter(stem);
const MAX_BYTES = 3 * 1024 * 1024;
mkdirSync(dirs.out, { recursive: true });
if (spawnSync("ffmpeg", ["-version"]).status !== 0) { console.error("ffmpeg not found. brew install ffmpeg"); process.exit(1); }
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
const duration = (f) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());

for (const scene of scenes) {
  if (only && scene !== only) continue;
  const still = findFile(dirs.stills, scene);
  const clip = findFile(dirs.clips, scene, /\.(mp4|mov|webm)$/i);
  if (still) { ff(["-i", still, "-vf", "scale=1600:-2", "-q:v", "4", join(dirs.out, `${scene}.jpg`)]); console.log(`✓ ${stem}/${scene}.jpg`); }
  if (clip) {
    const d = duration(clip), fade = 1.0, body = Math.max(2, d - fade);
    const out = join(dirs.out, `${scene}.mp4`);
    const filter = `[0:v]split[a][b];[a]trim=0:${body},setpts=PTS-STARTPTS[a1];[b]trim=${body}:${d},setpts=PTS-STARTPTS[b1];[a1][b1]xfade=transition=fade:duration=${fade}:offset=${body - fade}[v]`;
    let crf = 26, width = 1280;
    for (let attempt = 0; attempt < 4; attempt++) {
      ff(["-i", clip, "-filter_complex", `${filter};[v]scale='min(${width},iw)':-2[vs]`, "-map", "[vs]", "-an", "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-crf", String(crf), out]);
      const bytes = statSync(out).size;
      if (bytes <= MAX_BYTES) { console.log(`✓ ${stem}/${scene}.mp4  ${(bytes / 1048576).toFixed(2)} MB  (loop ${body.toFixed(1)}s)`); break; }
      crf += 3; if (attempt === 2) width = 960;
    }
    if (!still) { ff(["-i", out, "-frames:v", "1", "-q:v", "4", join(dirs.out, `${scene}.jpg`)]); console.log(`✓ ${stem}/${scene}.jpg (from clip)`); }
  }
  if (!still && !clip) console.log(`– ${scene}: nothing in media-src/${stem} yet`);
}
