/**
 * scene → media, per chapter. Files live in public/media/<chapter stem>/<scene>.{mp4,jpg}.
 * Missing files fall back at runtime: video → still → gradient. Never block on media.
 */
export type SceneMedia = { video?: string; image?: string };

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export function mediaFor(chapterStem: string, scene: string): SceneMedia {
  const dir = `${base}/media/${chapterStem}`;
  return { video: `${dir}/${scene}.mp4`, image: `${dir}/${scene}.jpg` };
}
