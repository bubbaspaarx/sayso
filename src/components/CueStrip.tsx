import { useEffect } from "react";
import type { Chapter } from "../content/schema";

type Cue = { itemId: string; at: number };

/** Items that flash briefly when their word is read. Not the bag. */
export function CueStrip({ chapter, cues, onExpire }: { chapter: Chapter; cues: Cue[]; onExpire: (now: number) => void }) {
  useEffect(() => {
    if (!cues.length) return;
    const t = window.setTimeout(() => onExpire(Date.now()), 2700);
    return () => window.clearTimeout(t);
  }, [cues, onExpire]);
  if (!cues.length) return null;
  return (
    <div className="pointer-events-none mb-3 flex h-14 items-end gap-3" aria-hidden>
      {cues.map((c) => {
        const item = chapter.items.find((i) => i.id === c.itemId);
        return (
          <span key={`${c.itemId}-${c.at}`} className="cue-flash text-5xl drop-shadow-[0_0_14px_rgba(255,213,138,0.7)]">
            {item?.emoji}
          </span>
        );
      })}
    </div>
  );
}
