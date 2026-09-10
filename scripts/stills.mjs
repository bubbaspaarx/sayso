// Generate scene stills through OpenRouter's unified Image API.
//   npm run stills                        all nine scenes, 2 candidates each
//   npm run stills -- greenhouse-dark 4   one scene, 4 candidates
//   DRY=1 npm run stills                  print requests, call nothing
// Key: OPENROUTER_API_KEY in the environment or in Sayso/.env (gitignored).
// Style lock: put your chosen reference still at media-src/ref/style.png and
// every later scene is generated with it as an input reference.
// greenhouse-glow is always made as an edit of media-src/stills/greenhouse-dark.*
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, parse } from "node:path";

const PREFIX =
  "Children's picture-book illustration, painterly gouache texture, soft edges, deep navy night palette with warm amber accents, gentle rim light, cosy English garden at night, storybook, no text, no watermark.";
const SCENES = ["bedroom-dark","grandma-room","kitchen-night","hall-night","garden-fork","shed-jackdaws","pond-night","greenhouse-dark","greenhouse-glow"];
const MODEL = process.env.STILLS_MODEL ?? "google/gemini-3.1-flash-image";
const OUT = "media-src/candidates";
const DRY = !!process.env.DRY;

const [only, nArg] = process.argv.slice(2);
const N = Math.max(1, parseInt(nArg ?? "2", 10));

function loadKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  if (existsSync(".env")) {
    const m = readFileSync(".env", "utf8").match(/^OPENROUTER_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

function scenePrompts() {
  const doc = readFileSync("VIDEO_PROMPTS.md", "utf8");
  const rows = [...doc.matchAll(/^\| `([a-z-]+)` \| (.+?) \| (.+?) \|$/gm)];
  return Object.fromEntries(rows.map(([, id, still]) => [id, still]));
}

const findFile = (dir, stem) => {
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).find((n) => parse(n).name === stem && /\.(png|jpe?g|webp)$/i.test(n));
  return f ? join(dir, f) : null;
};
const toDataUrl = (file) => {
  const ext = parse(file).ext.slice(1).toLowerCase();
  const mt = ext === "jpg" ? "jpeg" : ext;
  return `data:image/${mt};base64,${readFileSync(file).toString("base64")}`;
};

const key = loadKey();
if (!key && !DRY) {
  console.error("No OPENROUTER_API_KEY. Put it in the environment or in Sayso/.env, or run with DRY=1.");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });
const prompts = scenePrompts();
let total = 0;

for (const scene of SCENES) {
  if (only && scene !== only) continue;
  const body = { model: MODEL, prompt: "", aspect_ratio: "16:9" };
  const refs = [];

  if (scene === "greenhouse-glow") {
    const dark = findFile("media-src/stills", "greenhouse-dark");
    if (!dark) { console.log(`– ${scene}: needs media-src/stills/greenhouse-dark.* first (pick a candidate, then re-run)`); continue; }
    refs.push(dark);
    body.prompt =
      `Edit the reference image. Keep the greenhouse, bench, pot and composition exactly as they are; change only the light: ` +
      `${prompts[scene]} ${PREFIX}`;
  } else {
    const style = findFile("media-src/ref", "style");
    if (style) refs.push(style);
    body.prompt =
      `${PREFIX} ${prompts[scene]} Landscape 16:9, full-bleed edge to edge: no border, no frame, no paper edge, no vignette. No people, no faces.` +
      (style ? " Match the painting style, palette and level of detail of the reference image exactly; it is a different scene from the same book." : "");
  }
  if (refs.length) body.input_references = refs.map((f) => ({ type: "image_url", image_url: { url: toDataUrl(f) } }));

  for (let i = 1; i <= N; i++) {
    const out = join(OUT, `${scene}-${i}.png`);
    if (DRY) {
      console.log(`[dry] ${scene} #${i} model=${MODEL} refs=${refs.join(",") || "none"}\n      ${body.prompt.slice(0, 160)}…`);
      continue;
    }
    const res = await fetch("https://openrouter.ai/api/v1/images", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { console.error(`✗ ${scene} #${i}: HTTP ${res.status} ${await res.text()}`); continue; }
    const json = await res.json();
    const img = json.data?.[0];
    if (!img?.b64_json) { console.error(`✗ ${scene} #${i}: no image in response`, JSON.stringify(json).slice(0, 300)); continue; }
    writeFileSync(out, Buffer.from(img.b64_json, "base64"));
    const cost = json.usage?.cost ?? 0;
    total += cost;
    console.log(`✓ ${out}  $${cost.toFixed(3)}`);
  }
}
if (!DRY) console.log(`total $${total.toFixed(3)}`);
console.log("Pick winners into media-src/stills/<scene>.png; set media-src/ref/style.png to lock the look; then npm run media.");
