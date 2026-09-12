# Sayso — Decisions

## 2026-09-10
- **Web Speech API for v1, audio leaves the device.** Accepted for the prototype; on-device is a native Swift concern later. Criterion 6 reworded accordingly.
- **GitHub Pages hosting.** iOS needs HTTPS for the mic. Hetzner/Heroku fallback.
- **Pickup words are gates, never skipped.** User's call: going back later "feels like punishment"; the word is earned in the moment. Ordinary words keep the ≤2 hard-skip allowance; gate threshold loosens after 3/6 failed attempts instead of skipping.
- **Weak matches only at the cursor.** A heard token ≤2 chars, or a soft target, cannot cause a hard-word skip. Found on the first real read.
- **Stills through OpenRouter (Gemini 3.1 Flash Image), not Midjourney.** Midjourney has no free tier; OpenRouter uses the existing key and supports reference images for style lock and the dark→glow edit.
- **Video through OpenRouter's video API (Veo 3.1 Lite), not Kling's site.** Kling refused free-tier image-to-video. Veo Lite: $0.24 per 8s 720p clip, ~1 min, composition holds.
- **Ship loops now, not stills-only.** Total media ~6 MB, each loop <0.8 MB.

## 2026-09-11
- **Deploy on `master` as well as `main`.** Repo default branch is master.
- **Actions bumped to Node-24 majors** (checkout v7, setup-node v7, upload-pages-artifact v5, deploy-pages v5).

## 2026-09-12
- **Misreads are shown, not punished.** Skip allowance stays; skipped words get a dotted rose underline; a corrected re-read recovers the word in place. Recovery beats a skip-based forward match.
- **Report is for the adult, behind "For grown-ups".** Brief's "no metrics shown to the child" holds. Full-stop pauses are an estimate from word timestamps and labelled as such.
- **Engine keeps listening after completion** so the swallowed tail is credited.
- **Don't raise similarity; make skips provisional and hold on re-reads.** The liberal feel came from one lucky word moving the cursor three ahead, not from fuzziness.
- **Boots in the bedroom; cues (flash, not collect) for Grandma's three things.** First chime in passage one; the instruction passages now answer the reading without giving the puzzle away.
- **Parked, not rejected:** word-triggered scene effects and small sound effects.
- **A chapter is one JSON file, media prompts included.** `media` block in the chapter; scripts are chapter-aware (`--chapter`), sources and outputs live in per-chapter folders. Library screen when >1 chapter.
- **Characters stay out of the backgrounds** even for the mermaid book (turtle from behind, shark asleep is fine). The text carries Coral and Splash; faces in loops drift.
- **Same story template for chapter 2** (instructions → collect → fork → puzzle → payoff): it is what makes the pipeline repeatable, and the payoff pair (ship-door → ship-party) reuses the edit-of-anchor trick.
