import type { ChapterSummary } from "../content/loadChapter";
import { mediaFor } from "../media/mediaMap";
import { LevelPicker } from "../components/LevelPicker";
import { bandLabel, yearLabel, type Profile } from "../content/levels";
import type { Year } from "../content/schema";

type Props = {
  chapters: ChapterSummary[];
  profile: Profile;
  onProfile: (p: Profile) => void;
  onPick: (stem: string) => void;
};

export function Library({ chapters, profile, onProfile, onPick }: Props) {
  const years = [...new Set(chapters.flatMap((c) => c.years))] as Year[];
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-10 overflow-y-auto px-8 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,#1a2b5e_0%,#0b1530_55%,#060c1f_100%)]" />
      <div className="relative text-center fade-up">
        <div className="mb-2 text-lg font-bold uppercase tracking-[0.3em] text-white/50">Sayso</div>
        <h1 className="font-extrabold text-amber-soft" style={{ fontSize: "clamp(36px, 5vw, 64px)" }}>
          Pick a book
        </h1>
      </div>
      <div className="relative w-[min(880px,90vw)] fade-up">
        <LevelPicker profile={profile} onChange={onProfile} availableYears={years} />
      </div>
      <div className="relative flex flex-wrap items-stretch justify-center gap-8 fade-up">
        {chapters.map((c) => (
          <button
            key={c.stem}
            onClick={() => c.ok && onPick(c.stem)}
            disabled={!c.ok}
            className="group w-[min(420px,80vw)] overflow-hidden rounded-3xl border-2 border-white/15 bg-white/6 text-left shadow-xl transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            <div className="relative aspect-video w-full bg-navy-deep">
              {c.ok && (
                <img
                  src={mediaFor(c.stem, c.coverScene).image}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                />
              )}
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-navy-deep to-transparent" />
            </div>
            <div className="p-5">
              <div className="text-sm font-bold uppercase tracking-[0.2em] text-white/45">{c.series}</div>
              <div className="mt-1 text-3xl font-extrabold text-amber-soft">{c.title}</div>
              <div className="mt-2 text-sm text-white/55">
                {c.opensAt ? (
                  <>Opens at <b className="text-amber-soft">{yearLabel(c.opensAt.year)} · {bandLabel(c.opensAt.band)}</b></>
                ) : c.readingLevel ? c.readingLevel.split(".")[0] : null}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
