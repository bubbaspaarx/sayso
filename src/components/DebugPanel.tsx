import type { State } from "../engine/story";
import type { SpeechStatus } from "../speech/SpeechSource";

type Props = {
  state: State;
  speechName: string;
  status: SpeechStatus;
  restarts: number;
  finalText: string;
  interimText: string;
  onClose: () => void;
};

export function DebugPanel({ state, speechName, status, restarts, finalText, interimText, onClose }: Props) {
  const r = state.reading;
  const la = state.debug.lastAlignment;
  return (
    <div className="pointer-events-auto fixed inset-y-0 right-0 z-50 w-[min(420px,90vw)] overflow-y-auto bg-black/85 p-3 font-mono text-[12px] leading-snug text-white/90 backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <b>debug</b>
        <button className="rounded bg-white/15 px-2 py-0.5" onClick={onClose}>
          close
        </button>
      </div>
      <div className="mb-2 rounded bg-white/5 p-2">
        <div>
          screen <b>{state.screen}</b> · passage <b>{r.passageId}</b> · cursor{" "}
          <b>
            {r.cursor}/{r.tokens.length}
          </b>{" "}
          {r.complete && <span className="text-amber">complete</span>}
        </div>
        <div>
          {speechName} <b>{status}</b> · restarts {restarts}
        </div>
        {r.gateStall && (
          <div className="text-red-300">
            gate stall on "{r.tokens[r.gateStall.index]?.norm}" attempts {r.gateStall.attempts}
          </div>
        )}
        <div>bag: {state.bag.join(", ") || "—"}</div>
      </div>
      <div className="mb-2 rounded bg-white/5 p-2">
        <div className="text-white/50">transcript</div>
        <div className="whitespace-pre-wrap break-words">
          <span className="text-white">{finalText}</span> <span className="text-white/45">{interimText}</span>
        </div>
      </div>
      <div className="mb-2 rounded bg-white/5 p-2">
        <div className="text-white/50">last alignment</div>
        {la ? (
          <>
            {la.decisions.map((d, i) => (
              <div key={i}>
                {d.heard} →{" "}
                {d.expectedIndex === null ? (
                  <span className="text-white/40">ignored</span>
                ) : (
                  <span className="text-amber">
                    {d.expectedIndex}:{d.expected} ({d.via}
                    {d.skipped && d.skipped.length ? `, skipped ${d.skipped.join(",")}` : ""})
                  </span>
                )}
              </div>
            ))}
            {la.blockedByGate !== null && <div className="text-red-300">blocked by gate {la.blockedByGate}</div>}
          </>
        ) : (
          <div className="text-white/40">—</div>
        )}
      </div>
      <div className="mb-2 rounded bg-white/5 p-2">
        <div className="text-white/50">expected window</div>
        <div className="break-words">
          {r.tokens.slice(r.cursor, r.cursor + 8).map((t) => (
            <span key={t.index} className={t.gate ? "text-amber" : t.soft ? "text-white/40" : ""}>
              {t.norm}{" "}
            </span>
          ))}
        </div>
      </div>
      <div className="mb-2 rounded bg-white/5 p-2">
        <div className="text-white/50">pickups</div>
        {state.debug.pickupLog.length ? state.debug.pickupLog.map((l, i) => <div key={i}>{l}</div>) : "—"}
      </div>
      <div className="rounded bg-white/5 p-2">
        <div className="text-white/50">events</div>
        {state.debug.events.map((e, i) => (
          <div key={i}>{e}</div>
        ))}
      </div>
      <div className="mt-2 text-white/40">keys: space = next word, x = mumble next word, enter = next/continue</div>
    </div>
  );
}
