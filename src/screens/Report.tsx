import { useMemo, useState } from "react";
import type { State } from "../engine/story";
import { buildReport, reportAsText } from "../engine/report";

export function ReportScreen({ state, onClose }: { state: State; onClose: () => void }) {
  const r = useMemo(() => buildReport(state.history, state.chapter), [state.history, state.chapter]);
  const [copied, setCopied] = useState(false);
  const pct = Math.round(r.accuracy * 100);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportAsText(r, state.debug.events));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="relative h-full overflow-y-auto bg-navy px-[6vw] py-8 text-white">
      <div className="mx-auto max-w-[900px] fade-up">
        <div className="mb-1 text-sm font-bold uppercase tracking-[0.25em] text-white/45">For grown-ups</div>
        <h1 className="mb-1 text-4xl font-extrabold text-amber-soft">Reading report</h1>
        <div className="mb-6 text-white/55">
          {state.chapter.title}
          {state.levelId && state.chapter.levels?.[state.levelId]?.label ? ` · ${state.chapter.levels[state.levelId].label}` : ""}
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Words heard" value={`${r.heard}`} sub={`of ${r.totalWords}`} />
          <Stat label="Accuracy" value={`${pct}%`} sub="heard ÷ read" />
          <Stat label="Not heard" value={`${r.skipped}`} sub="skipped past" />
          <Stat label="Corrected" value={`${r.recovered}`} sub="re-read after a prompt" />
        </div>

        <Section title="Words to practise">
          {r.practice.length === 0 ? (
            <p className="text-white/60">None. Every word was heard.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {r.practice.map((p) => (
                <span key={p.word} className="rounded-full border border-white/15 bg-white/6 px-4 py-1.5 text-lg font-bold">
                  {p.word}
                  {p.count > 1 && <span className="ml-1 text-white/45">×{p.count}</span>}
                  {p.stalled && <span className="ml-2 text-xs font-bold uppercase text-amber/80">pickup</span>}
                </span>
              ))}
            </div>
          )}
          <p className="mt-3 text-sm text-white/45">
            “Not heard” means the cursor moved past the word without the microphone catching it. That is usually a misread, sometimes a mishear.
          </p>
        </Section>

        <Section title="Full stops">
          {r.fullStops.measured === 0 ? (
            <p className="text-white/60">Not enough timing data to estimate pauses this time.</p>
          ) : (
            <p className="text-xl">
              Paused at <b className="text-amber-soft">{r.fullStops.paused}</b> of {r.fullStops.measured} full stops we could time
              <span className="text-white/45"> ({r.fullStops.total} in the text)</span>.
            </p>
          )}
          <p className="mt-3 text-sm text-white/45">
            An estimate: a full stop counts as “paused” when the gap before the next word is clearly longer than the child's usual gap between words
            {r.fullStops.medianWithinMs !== null ? ` (about ${Math.round(r.fullStops.medianWithinMs)}ms this read)` : ""}.
          </p>
        </Section>

        {r.corrected.length > 0 && (
          <Section title="Corrected after a prompt">
            <p className="text-lg">{r.corrected.join(", ")}</p>
          </Section>
        )}

        <div className="mt-10 flex flex-wrap gap-4">
          <button className="btn btn-amber" onClick={onClose}>
            Back
          </button>
          <button className="btn btn-ghost" onClick={copy}>
            {copied ? "Copied" : "Copy details"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs font-bold uppercase tracking-wider text-white/45">{label}</div>
      <div className="text-4xl font-extrabold text-amber-soft">{value}</div>
      <div className="text-sm text-white/50">{sub}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-2xl font-extrabold">{title}</h2>
      {children}
    </section>
  );
}
