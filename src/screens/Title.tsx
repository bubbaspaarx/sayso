import { useRef } from "react";
import type { Chapter } from "../content/schema";

export function Title({ chapter, onStart, onTripleTap }: { chapter: Chapter; onStart: () => void; onTripleTap: () => void }) {
  const taps = useRef<number[]>([]);
  const tap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 700), now];
    if (taps.current.length >= 3) {
      taps.current = [];
      onTripleTap();
    }
  };
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-10 px-8 text-center">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,#1a2b5e_0%,#0b1530_55%,#060c1f_100%)]" />
      <div className="relative fade-up">
        <div className="mb-3 text-lg font-bold uppercase tracking-[0.25em] text-white/50">{chapter.series}</div>
        <h1
          onPointerDown={tap}
          className="font-extrabold leading-tight text-amber-soft"
          style={{ fontSize: "clamp(40px, 6vw, 84px)" }}
        >
          {chapter.title}
        </h1>
      </div>
      <button className="btn btn-amber relative fade-up" onClick={onStart} autoFocus>
        Start reading
      </button>
    </div>
  );
}
