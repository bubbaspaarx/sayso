import type { State } from "../engine/story";
import { SceneMedia } from "../components/SceneMedia";

export function Hint({ state, onDismiss }: { state: State; onDismiss: () => void }) {
  const q = state.chapter.puzzles[state.puzzle!.id];
  const hint = state.chapter.passages[q.hintPassage];
  const passage = state.chapter.passages[state.reading.passageId];
  return (
    <div className="relative h-full overflow-hidden">
      <SceneMedia stem={state.stem} scene={passage.scene} />
      <div className="absolute inset-0 z-10 flex items-center justify-center px-[6vw]">
        <div className="fade-up flex max-w-[1000px] flex-col items-center gap-8 rounded-3xl border-2 border-amber/40 bg-navy-deep/85 p-10 shadow-2xl">
          <div className="text-lg font-bold uppercase tracking-[0.25em] text-amber/70">Remember</div>
          <p className="font-semibold leading-[1.65] text-white/90" style={{ fontSize: "clamp(26px, 2.8vw, 36px)" }}>
            {hint.text}
          </p>
          <button className="btn btn-amber" onClick={onDismiss} autoFocus>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
