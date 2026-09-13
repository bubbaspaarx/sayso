# Sayso — Active

Reading MVP (Nell and the Cold Night). Brief + decisions log in `Sayso/CLAUDE.md`. Tasks in `Workboard/Sayso/`.

## Status
_2026-09-12:_ first child read done (user's son, 7). Recognition "accurate to what a child says". Three defects found and fixed same day (next-sentence hop, uncredited tail, no misread feedback) and a reading report added for adults. Committed and deployed by the user (b81b155, Actions green).

## In Progress
- 2026-09-13: reading levels (year × band slider, narration line below the child's text) and the logo/brand assets built; 49 tests green; **uncommitted** until the user pushes.
- **Chapter 2 (Coral and the Bubble Party)** complete 2026-09-12 22:46: 10 stills, 10 loops, 0 redos, $4.03, ~21 min. Ledger in `curation-ledger.md` + published artifact. Deployed (b81b155).
- Nothing mid-flight. Working tree clean at b81b155; both books live.

## Next Steps
1. Push levels; daughter re-reads chapter 2 at Year 1 Beginner (narration line read by the adult); son re-reads Nell for skip tuning; use End → For grown-ups → Copy details and paste the dump into the session (replaces hunting for the debug panel).
2. Validate the full-stop pause estimate against what the adult saw; tune thresholds in `report.ts`.
3. Grow `src/engine/confusions.ts` from the "words to practise" list where they are mishears, not misreads.
4. Rotate the OpenRouter key.
5. Parked (user likes both, thinking): word-triggered scene effects; small sound effects. Also "continuation elements"; native Swift prototype.

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
- [x] Chapter 2 built and ledgered (2026-09-12)
- [ ] Daughter's first read of chapter 2
- [ ] Child test → confusion table
- [ ] Residual risk: final-revises-interim re-feed could double-advance on repeated words (caw caw caw). Watch, don't pre-fix.
