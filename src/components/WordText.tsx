import type { Reading } from "../engine/story";

export function WordText({ reading, dim = false }: { reading: Reading; dim?: boolean }) {
  const { words, tokens, cursor, matched } = reading;
  return (
    <p
      className={`font-semibold leading-[1.65] ${dim ? "opacity-40" : ""}`}
      style={{ fontSize: "clamp(28px, 3.1vw, 40px)" }}
    >
      {words.map((w, i) => {
        let cls = "";
        if (w.tokenIndex >= 0) {
          const t = tokens[w.tokenIndex];
          if (matched.has(t.index) || t.index < cursor) cls = "word-read";
          else if (t.index === cursor) cls = "word-current";
          else cls = "word-unread";
        } else cls = "word-unread";
        return (
          <span key={i} className={`word ${cls}`}>
            {w.text}{" "}
          </span>
        );
      })}
    </p>
  );
}
