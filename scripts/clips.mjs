// Animate scene stills through OpenRouter's video API (async: submit, poll, download).
//   npm run clips -- greenhouse-glow          one scene
//   npm run clips                             every scene that has a still but no clip
//   CLIPS_MODEL=kwaivgi/kling-v3.0-std npm run clips -- pond-night
// Output: media-src/clips/<scene>.mp4  → then `npm run media -- <scene>` to loop it.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, parse } from "node:path";

const MODEL = process.env.CLIPS_MODEL ?? "google/veo-3.1-lite";
const DURATION = Number(process.env.CLIPS_SECONDS ?? 8);
const SCENES = ["bedroom-dark","grandma-room","kitchen-night","hall-night","garden-fork","shed-jackdaws","pond-night","greenhouse-dark","greenhouse-glow"];
const only = process.argv[2];
const OUT = "media-src/clips";
mkdirSync(OUT, { recursive: true });

function loadKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  if (existsSync(".env")) {
    const m = readFileSync(".env", "utf8").match(/^OPENROUTER_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}
const key = loadKey();
if (!key) { console.error("No OPENROUTER_API_KEY (env or Sayso/.env)."); process.exit(1); }
const H = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

function motionPrompts() {
  const doc = readFileSync("VIDEO_PROMPTS.md", "utf8");
  const suffix = [...doc.matchAll(/^> (.+)$/gm)].map((m) => m[1]).slice(-4).join(" "); // motion suffix block (last quoted block)
  const rows = [...doc.matchAll(/^\| `([a-z-]+)` \| (.+?) \| (.+?) \|$/gm)];
  return Object.fromEntries(rows.map(([, id, , motion]) => [id, `${motion} ${suffix}`]));
}
const findFile = (dir, stem) => {
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).find((n) => parse(n).name === stem && /\.(png|jpe?g|webp)$/i.test(n));
  return f ? join(dir, f) : null;
};
const toDataUrl = (file) => {
  const ext = parse(file).ext.slice(1).toLowerCase();
  return `data:image/${ext === "jpg" ? "jpeg" : ext};base64,${readFileSync(file).toString("base64")}`;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const prompts = motionPrompts();
let total = 0;
for (const scene of SCENES) {
  if (only && scene !== only) continue;
  const out = join(OUT, `${scene}.mp4`);
  if (!only && existsSync(out)) { console.log(`– ${scene}: clip exists, skipping`); continue; }
  const still = findFile("media-src/stills", scene);
  if (!still) { console.log(`– ${scene}: no still in media-src/stills`); continue; }

  const body = {
    model: MODEL,
    prompt: prompts[scene],
    duration: DURATION,
    resolution: "720p",
    aspect_ratio: "16:9",
    generate_audio: false,
    frame_images: [{ type: "image_url", image_url: { url: toDataUrl(still) }, frame_type: "first_frame" }],
  };
  process.stdout.write(`${scene}: submitting to ${MODEL}… `);
  const res = await fetch("https://openrouter.ai/api/v1/videos", { method: "POST", headers: H, body: JSON.stringify(body) });
  if (!res.ok) { console.error(`\n✗ ${scene}: HTTP ${res.status} ${(await res.text()).slice(0, 400)}`); continue; }
  const job = await res.json();
  const pollUrl = job.polling_url ?? `https://openrouter.ai/api/v1/videos/${job.id}`;
  process.stdout.write(`job ${job.id}\n`);

  let status = job.status, last = job;
  const t0 = Date.now();
  while (!["completed", "failed", "cancelled", "expired"].includes(status)) {
    await sleep(15000);
    const p = await fetch(pollUrl, { headers: H });
    last = await p.json();
    status = last.status;
    process.stdout.write(`  ${Math.round((Date.now() - t0) / 1000)}s ${status}${last.progress != null ? ` ${last.progress}%` : ""}\r`);
  }
  console.log("");
  if (status !== "completed") { console.error(`✗ ${scene}: ${status} ${JSON.stringify(last).slice(0, 400)}`); continue; }

  const src = last.unsigned_urls?.[0] ?? `https://openrouter.ai/api/v1/videos/${job.id}/content?index=0`;
  const v = await fetch(src, { headers: H });
  if (!v.ok) { console.error(`✗ ${scene}: download HTTP ${v.status}`); continue; }
  writeFileSync(out, Buffer.from(await v.arrayBuffer()));
  const cost = last.usage?.cost ?? last.cost ?? null;
  if (cost != null) total += Number(cost);
  console.log(`✓ ${out}${cost != null ? `  $${Number(cost).toFixed(3)}` : ""}`);
}
if (total) console.log(`total $${total.toFixed(3)}`);
