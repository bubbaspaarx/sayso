# Sayso — Active

Reading MVP (Nell and the Cold Night). Brief + decisions log in `Sayso/CLAUDE.md`. Tasks in `Workboard/Sayso/`.

## Status
_2026-09-12:_ first child read done (user's son, 7). Recognition "accurate to what a child says". Three defects found and fixed same day (next-sentence hop, uncredited tail, no misread feedback) and a reading report added for adults. **Uncommitted locally** — needs `git add -A && git commit && git push` to deploy.

## In Progress
- Awaiting commit/push of the 2026-09-12 batch (feed fix, skipped highlight, recovery, report, tail credit, x key). 34 tests green, build clean.

## Next Steps
1. Push the 2026-09-12 batch; re-read with the child; use End → For grown-ups → Copy details and paste the dump into the session (replaces hunting for the debug panel).
2. Validate the full-stop pause estimate against what the adult saw; tune thresholds in `report.ts`.
3. Grow `src/engine/confusions.ts` from the "words to practise" list where they are mishears, not misreads.
4. Rotate the OpenRouter key.
5. Parked: "more interactions and continuation elements"; native Swift prototype.

## Blockers
- (none) — everything else waits on a child and an iPad.

## Threads
- [x] Build order steps 1–7 (2026-09-10)
- [x] Aligner gate rule + weak-match fix (2026-09-10)
- [x] Stills via OpenRouter, loops via Veo 3.1 Lite (2026-09-10/11)
- [x] Pages deploy on `master` (2026-09-11)
- [x] iPad autoplay check (loops running, 2026-09-12)
- [x] Next-sentence hop fixed in TranscriptFeed (2026-09-12)
- [x] Skipped highlight + recovery + report (2026-09-12)
- [ ] Pause heuristic validation
- [ ] Child test → confusion table
- [ ] Residual risk: final-revises-interim re-feed could double-advance on repeated words (caw caw caw). Watch, don't pre-fix.
