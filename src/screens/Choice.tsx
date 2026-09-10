import type { Passage } from "../content/schema";

export function Choice({ passage, onChoose }: { passage: Passage; onChoose: (next: string) => void }) {
  const choice = passage.choice!;
  return (
    <div className="fade-up flex flex-col items-center gap-8 px-8">
      <div className="text-center font-extrabold text-amber-soft" style={{ fontSize: "clamp(32px, 4vw, 52px)" }}>
        {choice.prompt}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-6">
        {choice.options.map((o) => (
          <button key={o.next + o.label} className="btn btn-ghost min-w-[260px]" onClick={() => onChoose(o.next)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
