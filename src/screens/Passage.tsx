import type { ReactNode } from "react";
import type { State } from "../engine/story";
import type { SpeechStatus } from "../speech/SpeechSource";
import { SceneMedia } from "../components/SceneMedia";
import { WordText } from "../components/WordText";
import { Bag } from "../components/Bag";
import { MicIndicator } from "../components/MicIndicator";
import { CueStrip } from "../components/CueStrip";

type Props = {
  state: State;
  status: SpeechStatus;
  onNext: () => void;
  onCueExpire?: (now: number) => void;
  dim?: boolean;
  overlay?: ReactNode;
};

export function Passage({ state, status, onNext, onCueExpire = () => {}, dim = false, overlay }: Props) {
  const passage = state.chapter.passages[state.reading.passageId];
  return (
    <div className="relative h-full overflow-hidden">
      <SceneMedia stem={state.stem} scene={passage.scene} />
      <div className="absolute right-4 top-4 z-20" style={{ top: "max(1rem, env(safe-area-inset-top))" }}>
        <MicIndicator status={status} />
      </div>
      <div className="absolute inset-0 z-10 flex flex-col">
        <div className="flex flex-1 items-end justify-center px-[6vw] pb-6 pt-20">
          <div className="w-full max-w-[1100px]">
            <CueStrip chapter={state.chapter} cues={state.reading.cues} onExpire={onCueExpire} />
            <WordText reading={state.reading} dim={dim} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 px-[6vw] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <Bag chapter={state.chapter} bag={state.bag} justPicked={state.justPicked} />
          <div className="min-w-[160px] text-right">
            {state.reading.complete && !dim && (
              <button className="btn btn-amber fade-up" onClick={onNext}>
                Next
              </button>
            )}
          </div>
        </div>
      </div>
      {overlay && (
        <div className="absolute inset-0 z-30 flex items-start justify-center bg-navy-deep/55 pt-[12vh]">{overlay}</div>
      )}
    </div>
  );
}
