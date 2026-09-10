// Turns media-src/{stills,clips}/<scene>.* into public/media/<scene>.{jpg,mp4}.
// - stills: resized to 1600px wide JPG (poster + CSS-pan fallback)
// - clips:  tail cross-faded into head for a seamless loop, muted, faststart, ≤3MB
// Usage: npm run media            (all scenes)
//        npm run media -- pond-night   (one scene)
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, parse } from "node:path";

const SCENES = ["bedroom-dark","grandma-room","kitchen-night","hall-night","garden-fork","shed-jackdaws","pond-night","greenhouse-dark","greenhouse-glow"];
const only = process.argv[2];
const OUT = "public/media";
const MAX_BYTES = 3 * 1024 * 1024;
mkdirSync(OUT, { recursive: true });

if (spawnSync("ffmpeg", ["-version"]).status !== 0) {
  console.error("ffmpeg not found. brew install ffmpeg");
  process.exit(1);
}

const find = (dir, scene) => {
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).find((n) => parse(n).name === scene);
  return f ? join(dir, f) : null;
};
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
const duration = (file) =>
  parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString());

for (const scene of SCENES) {
  if (only && scene !== only) continue;
  const still = find("media-src/stills", scene);
  const clip = find("media-src/clips", scene);

  if (still) {
    ff(["-i", still, "-vf", "scale=1600:-2", "-q:v", "4", join(OUT, `${scene}.jpg`)]);
    console.log(`✓ ${scene}.jpg`);
  }

  if (clip) {
    const d = duration(clip);
    const fade = 1.0;
    const body = Math.max(2, d - fade); // seconds of unique footage after the crossfade
    const out = join(OUT, `${scene}.mp4`);
    // [a] = 0..body, [b] = body..d ; xfade b's start over a's end so the last frame flows into the first
    const filter =
      `[0:v]split[a][b];` +
      `[a]trim=0:${body},setpts=PTS-STARTPTS[a1];` +
      `[b]trim=${body}:${d},setpts=PTS-STARTPTS[b1];` +
      `[a1][b1]xfade=transition=fade:duration=${fade}:offset=${body - fade}[v]`;
    let crf = 26;
    let width = 1280;
    for (let attempt = 0; attempt < 4; attempt++) {
      ff([
        "-i", clip, "-filter_complex", `${filter};[v]scale=${width}:-2[vs]`, "-map", "[vs]", "-an",
        "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-crf", String(crf), out,
      ]);
      const bytes = statSync(out).size;
      if (bytes <= MAX_BYTES) {
        console.log(`✓ ${scene}.mp4  ${(bytes / 1048576).toFixed(2)} MB  (crf ${crf}, ${width}px, loop ${(body).toFixed(1)}s)`);
        break;
      }
      crf += 3;
      if (attempt === 2) width = 960;
      console.log(`  ${scene}.mp4 is ${(bytes / 1048576).toFixed(2)} MB, retrying crf ${crf} ${width}px`);
    }
    if (!still) {
      // Poster from the first frame so there is always a still fallback.
      ff(["-i", out, "-frames:v", "1", "-q:v", "4", join(OUT, `${scene}.jpg`)]);
      console.log(`✓ ${scene}.jpg (from clip)`);
    }
  }

  if (!still && !clip) console.log(`– ${scene}: nothing in media-src yet`);
}
