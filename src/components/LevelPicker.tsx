import { BANDS, YEARS, type Band, type Year } from "../content/schema";
import { bandLabel, yearLabel, type Profile } from "../content/levels";

type Props = { profile: Profile; onChange: (p: Profile) => void; availableYears?: Year[] };

/** Year segmented control + Beginner→Advanced slider. Remembered on the device. */
export function LevelPicker({ profile, onChange, availableYears }: Props) {
  const years = availableYears ?? [...YEARS];
  const bandIdx = BANDS.indexOf(profile.band);
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/12 bg-white/5 p-4">
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-white/45">School year</div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="School year">
          {YEARS.map((y) => {
            const on = y === profile.year;
            const has = years.includes(y);
            return (
              <button
                key={y}
                role="radio"
                aria-checked={on}
                onClick={() => onChange({ ...profile, year: y })}
                className={`rounded-full px-4 py-1.5 text-base font-extrabold transition-colors ${
                  on ? "bg-amber text-navy-deep" : has ? "bg-white/10 text-white/85" : "bg-white/5 text-white/30"
                }`}
                title={has ? yearLabel(y) : `${yearLabel(y)} — no book at this year yet`}
              >
                {y === "R" ? "R" : y}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-[0.18em] text-white/45">
          <span>Beginner</span>
          <span className="text-amber-soft">{bandLabel(profile.band)}</span>
          <span>Advanced</span>
        </div>
        <input
          type="range"
          min={0}
          max={BANDS.length - 1}
          step={1}
          value={bandIdx}
          aria-label="Ability"
          aria-valuetext={bandLabel(profile.band)}
          onChange={(e) => onChange({ ...profile, band: BANDS[Number(e.target.value)] as Band })}
          className="level-slider w-full"
        />
      </div>
    </div>
  );
}
