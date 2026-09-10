/**
 * scene id → media. Files live in public/media/. Missing files fall back at
 * runtime: video → still → gradient. Never block on media.
 */
export type SceneMedia = { video?: string; image?: string };

const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const m = (name: string): SceneMedia => ({
  video: `${base}/media/${name}.mp4`,
  image: `${base}/media/${name}.jpg`,
});

export const mediaMap: Record<string, SceneMedia> = {
  "bedroom-dark": m("bedroom-dark"),
  "grandma-room": m("grandma-room"),
  "kitchen-night": m("kitchen-night"),
  "hall-night": m("hall-night"),
  "garden-fork": m("garden-fork"),
  "shed-jackdaws": m("shed-jackdaws"),
  "pond-night": m("pond-night"),
  "greenhouse-dark": m("greenhouse-dark"),
  "greenhouse-glow": m("greenhouse-glow"),
};

export function mediaFor(scene: string): SceneMedia {
  return mediaMap[scene] ?? {};
}
