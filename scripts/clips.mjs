// Animate chosen stills through OpenRouter's video API (async: submit, poll, download).
//   npm run clips -- --chapter chapter-02              every scene with a still but no clip
//   npm run clips -- --chapter chapter-02 ship-party   one scene (overwrites)
//   CLIPS_MODEL=kwaivgi/kling-v3.0-std npm run clips -- --chapter chapter-02 rock-pool
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chapterArg, findFile, loadChapter, loadKey, sleep, toDataUrl } from "./lib.mjs";

const { stem, rest } = chapterArg(process.argv.slice(2));
const [only] = rest;
const MODEL = process.env.CLIPS_MODEL ?? "google/veo-3.1-lite";
const DURATION = Number(process.env.CLIPS_SECONDS ?? 8);
const { ch, scenes, dirs } = loadChapter(stem);
const key = loadKey();
if (!key) { console.error("No OPENROUTER_API_KEY (env or Sayso/.env)."); process.exit(1); }
const H = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
mkdirSync(dirs.clips, { recursive: true });
let total = 0;

for (const scene of scenes) {
  if (only && scene !== only) continue;
  const out = join(dirs.clips, `${scene}.mp4`);
  if (!only && existsSync(out)) { console.log(`– ${scene}: clip exists, skipping`); continue; }
  const still = findFile(dirs.stills, scene);
  if (!still) { console.log(`– ${scene}: no still in ${dirs.stills}`); continue; }
  const body = {
    model: MODEL, prompt: `${ch.media.scenes[scene].motion} ${ch.media.motionSuffix}`,
    duration: DURATION, resolution: "720p", aspect_ratio: "16:9", generate_audio: false,
    frame_images: [{ type: "image_url", image_url: { url: toDataUrl(still) }, frame_type: "first_frame" }],
  };
  process.stdout.write(`${scene}: submitting to ${MODEL}… `);
  const res = await fetch("https://openrouter.ai/api/v1/videos", { method: "POST", headers: H, body: JSON.stringify(body) });
  if (!res.ok) { console.error(`\n✗ ${scene}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`); continue; }
  const job = await res.json();
  const pollUrl = job.polling_url ?? `https://openrouter.ai/api/v1/videos/${job.id}`;
  process.stdout.write(`job ${job.id}\n`);
  let status = job.status, last = job;
  const t0 = Date.now();
  while (!["completed", "failed", "cancelled", "expired"].includes(status)) {
    await sleep(15000);
    last = await (await fetch(pollUrl, { headers: H })).json();
    status = last.status;
    process.stdout.write(`  ${Math.round((Date.now() - t0) / 1000)}s ${status}\r`);
  }
  console.log("");
  if (status !== "completed") { console.error(`✗ ${scene}: ${status} ${JSON.stringify(last).slice(0, 300)}`); continue; }
  const src = last.unsigned_urls?.[0] ?? `https://openrouter.ai/api/v1/videos/${job.id}/content?index=0`;
  const v = await fetch(src, { headers: H });
  if (!v.ok) { console.error(`✗ ${scene}: download HTTP ${v.status}`); continue; }
  writeFileSync(out, Buffer.from(await v.arrayBuffer()));
  const cost = Number(last.usage?.cost ?? last.cost ?? 0);
  total += cost;
  console.log(`✓ ${out}  $${cost.toFixed(3)}`);
}
console.log(`total $${total.toFixed(3)}`);
