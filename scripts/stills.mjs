// Generate scene stills through OpenRouter's unified Image API.
//   npm run stills -- --chapter chapter-02              every scene, 2 candidates each
//   npm run stills -- --chapter chapter-02 ship-door 4  one scene, 4 candidates
//   DRY=1 npm run stills -- --chapter chapter-02        print requests, call nothing
// Style lock: media-src/<chapter>/ref/style.png (copy your chosen anchor still there).
// Scenes with `editOf` are generated as an edit of that scene's chosen still.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chapterArg, findFile, loadChapter, loadKey, toDataUrl } from "./lib.mjs";

const { stem, rest } = chapterArg(process.argv.slice(2));
const [only, nArg] = rest;
const N = Math.max(1, parseInt(nArg ?? "2", 10));
const MODEL = process.env.STILLS_MODEL ?? "google/gemini-3.1-flash-image";
const DRY = !!process.env.DRY;
const { ch, scenes, dirs } = loadChapter(stem);
const key = loadKey();
if (!key && !DRY) { console.error("No OPENROUTER_API_KEY (env or Sayso/.env), or run with DRY=1."); process.exit(1); }
mkdirSync(dirs.candidates, { recursive: true });
let total = 0;

for (const scene of scenes) {
  if (only && scene !== only) continue;
  const sc = ch.media.scenes[scene];
  const body = { model: MODEL, prompt: "", aspect_ratio: "16:9" };
  const refs = [];
  if (sc.editOf) {
    const src = findFile(dirs.stills, sc.editOf);
    if (!src) { console.log(`– ${scene}: needs ${dirs.stills}/${sc.editOf}.* first (pick a candidate, then re-run)`); continue; }
    refs.push(src);
    body.prompt = `${sc.still} ${ch.media.stylePrefix}`;
  } else {
    const style = findFile(dirs.ref, "style");
    if (style) refs.push(style);
    body.prompt =
      `${ch.media.stylePrefix} ${sc.still} Landscape 16:9, full-bleed edge to edge: no border, no frame, no paper edge, no vignette. No people, no faces.` +
      (style ? " Match the painting style, palette and level of detail of the reference image exactly; it is a different scene from the same book." : "");
  }
  if (refs.length) body.input_references = refs.map((f) => ({ type: "image_url", image_url: { url: toDataUrl(f) } }));

  for (let i = 1; i <= N; i++) {
    const out = join(dirs.candidates, `${scene}-${i}.png`);
    if (DRY) { console.log(`[dry] ${scene} #${i} refs=${refs.join(",") || "none"}\n      ${body.prompt.slice(0, 140)}…`); continue; }
    const res = await fetch("https://openrouter.ai/api/v1/images", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!res.ok) { console.error(`✗ ${scene} #${i}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`); continue; }
    const json = await res.json();
    const img = json.data?.[0];
    if (!img?.b64_json) { console.error(`✗ ${scene} #${i}: no image`, JSON.stringify(json).slice(0, 200)); continue; }
    writeFileSync(out, Buffer.from(img.b64_json, "base64"));
    const cost = Number(json.usage?.cost ?? 0);
    total += cost;
    console.log(`✓ ${out}  $${cost.toFixed(3)}`);
  }
}
if (!DRY) console.log(`total $${total.toFixed(3)}`);
console.log(`Pick winners into ${dirs.stills}/<scene>.png; copy the anchor to ${dirs.ref}/style.png; then npm run media -- --chapter ${stem}`);
