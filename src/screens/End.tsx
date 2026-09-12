export function End({ onAgain, onReport }: { onAgain: () => void; onReport: () => void }) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-12 px-8 text-center">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,#12305a_0%,#0b1530_55%,#060c1f_100%)]" />
      <div className="felix-glow relative rounded-full bg-felix/15 px-14 py-8 fade-up">
        <div className="font-extrabold text-white" style={{ fontSize: "clamp(44px, 7vw, 96px)" }}>
          You did it.
        </div>
      </div>
      <button className="btn btn-amber relative fade-up" onClick={onAgain} autoFocus>
        Read it again
      </button>
      <button
        className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-5 rounded-full bg-white/8 px-4 py-2 text-sm font-bold text-white/45"
        onClick={onReport}
      >
        For grown-ups
      </button>
    </div>
  );
}
