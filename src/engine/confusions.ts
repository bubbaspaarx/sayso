/**
 * Homophone / ASR-confusion table. Tokens in the same group match each other.
 * Grow this from the debug panel log during child testing.
 */
const GROUPS: string[][] = [
  ["to", "two", "too"],
  ["their", "there", "they're"],
  ["nell", "now", "knell", "nel", "nail", "neil", "null"],
  ["fen", "fan", "fenn", "ven", "when", "phen"],
  ["felix", "phoenix", "feelix", "philix", "felux"],
  ["luminis", "luminous", "lumenis", "luminess"],
  ["radix", "radish", "radics", "raddicks"],
  ["jackdaws", "jackdaw", "jackdoors", "jack-daws"],
  ["caw", "core", "car", "cor", "cour", "kaw"],
  ["glow", "glue", "glo"],
  ["glowed", "glued", "gloat"],
  ["glowing", "gluing", "growing"],
  ["shed", "shared", "shared"],
  ["pond", "pound", "pawned"],
  ["wool", "wall", "will"],
  ["grey", "gray"],
  ["one", "won"],
  ["knew", "new"],
  ["sun", "son"],
  ["hook", "hawk"],
  ["torch", "torches", "touch"],
  ["lantern", "lanton", "lantan", "lanturn"],
  ["blanket", "blankit"],
  ["hummed", "hummed", "hum", "hummd"],
  ["humming", "hummin"],
  ["plopped", "plopt", "plop"],
  ["thump", "thumped", "bump"],
  ["mugs", "mug"],
  ["wellington", "wellingtons"],
  ["whispered", "whisper"],
  ["tucked", "tuck"],
  ["door", "dor", "dawn"],
  ["night", "knight"],
  ["hall", "haul", "hole"],
  ["bag", "back"],
  ["cross", "crossed"],
];

const lookup = new Map<string, number>();
GROUPS.forEach((g, gi) => g.forEach((w) => lookup.set(w, gi)));

export function areConfusable(a: string, b: string): boolean {
  const ga = lookup.get(a);
  return ga !== undefined && ga === lookup.get(b);
}

/** Multi-token ASR outputs that should collapse into one expected token. */
const COMPOUNDS: [string[], string][] = [
  [["green", "house"], "greenhouse"],
  [["jack", "doors"], "jackdaws"],
  [["jack", "draws"], "jackdaws"],
  [["jack", "does"], "jackdaws"],
  [["back", "door"], "backdoor"], // not in text, harmless
  [["lumen", "is"], "luminis"],
];

export function mergeCompounds(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    let merged = false;
    for (const [parts, whole] of COMPOUNDS) {
      if (parts.every((p, k) => tokens[i + k] === p)) {
        out.push(whole);
        i += parts.length - 1;
        merged = true;
        break;
      }
    }
    if (!merged) out.push(tokens[i]);
  }
  return out;
}
