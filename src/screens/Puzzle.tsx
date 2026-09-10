import type { State } from "../engine/story";
import { SceneMedia } from "../components/SceneMedia";

type Props = {
  state: State;
  onToggle: (itemId: string) => void;
  onTry: () => void;
  onContinue: () => void;
};

export function PuzzleScreen({ state, onToggle, onTry, onContinue }: Props) {
  const pz = state.puzzle!;
  const q = state.chapter.puzzles[pz.id];
  const passage = state.chapter.passages[state.reading.passageId];
  const items = state.bag.map((id) => state.chapter.items.find((i) => i.id === id)!).filter(Boolean);
  const ready = pz.selected.length === q.pickCount;

  return (
    <div className="relative h-full overflow-hidden">
      <SceneMedia scene={passage.scene} />
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-8 px-[6vw]">
        {pz.success ? (
          <div className="fade-up flex flex-col items-center gap-8 text-center">
            <div className="felix-glow rounded-full bg-felix/20 px-10 py-6 font-extrabold text-white" style={{ fontSize: "clamp(36px, 5vw, 64px)" }}>
              Yes!
            </div>
            <button className="btn btn-amber" onClick={onContinue} autoFocus>
              Keep reading
            </button>
          </div>
        ) : (
          <>
            <div className="fade-up text-center font-extrabold text-amber-soft" style={{ fontSize: "clamp(30px, 3.6vw, 48px)" }}>
              {q.prompt}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-5">
              {items.map((it) => {
                const on = pz.selected.includes(it.id);
                return (
                  <button
                    key={it.id}
                    onClick={() => onToggle(it.id)}
                    aria-pressed={on}
                    className={`flex h-36 w-36 flex-col items-center justify-center gap-1 rounded-3xl border-4 transition-all active:scale-95 md:h-44 md:w-44 ${
                      on ? "border-amber bg-amber/25 shadow-[0_0_30px_rgba(245,182,74,0.45)]" : "border-white/20 bg-white/8"
                    }`}
                  >
                    <span className="text-6xl md:text-7xl">{it.emoji}</span>
                    <span className="text-xl font-bold">{it.label}</span>
                  </button>
                );
              })}
              {items.length === 0 && <div className="text-2xl text-white/60">The bag is empty.</div>}
            </div>
            <div className="flex h-12 items-center text-center text-2xl font-bold text-white/85">{pz.feedback ?? ""}</div>
            <button className="btn btn-amber" disabled={!ready} onClick={onTry}>
              Try
            </button>
          </>
        )}
      </div>
    </div>
  );
}
