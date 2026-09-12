# Curation ledger — Chapter 2, "Coral and the Bubble Party"

Measured 2026-09-12, one sitting, one person + Claude Code. From a two-sentence brief
("a mermaid and a swimming unicorn, Ariel-and-Flounder fun, for a nearly-6-year-old")
to a playable book with ten animated scenes in the live app.

## Timeline (wall-clock)

| From | To | Step | Minutes |
|---|---|---|---|
| 22:24:59 | 22:27:26 | Write the story (11 passages, 5 items, 1 fork, 1 puzzle, 3 cues) and the 10 scene prompts; make the pipeline chapter-aware; library screen | 2.5 |
| 22:27:26 | 22:32:03 | Stills round 1: 4 anchor candidates, pick, then 18 candidates for 9 scenes with the anchor as style reference | 4.6 |
| 22:32:03 | 22:33:31 | Review sheet, pick 8, generate the party scene as an edit of the door, pick | 1.5 |
| 22:33:31 | 22:44:08 | 10 clips via Veo 3.1 Lite (8 s, 720p), one job at a time | 10.6 |
| 22:44:08 | 22:46 | Contact-sheet review, loop + compress, build | ~1.5 |
| | | **Total** | **~21** |

## Cost (API, OpenRouter)

| Item | Count | Unit | Total |
|---|---|---|---|
| Still candidates (Gemini 3.1 Flash Image) | 24 | $0.068 | $1.63 |
| Clips (Veo 3.1 Lite, 8 s, no audio) | 10 | $0.240 | $2.40 |
| Redos | 0 | | $0.00 |
| **Total** | | | **$4.03** |

Not counted: the Claude Code session itself (tokens), and the author's time reading and approving.

## Human judgments required

- 1 anchor pick (from 4), 8 scene picks (from 2 each), 1 party pick (from 2), 10 clip approvals from contact sheets → **20 yes/no decisions**, no prompt rewrites.
- 0 redos this time. Chapter 1 needed 2 still redos and 4 clip redos while the prompt rules were being learned; those rules now live in the chapter template (pin what must not move; say "no border"; keep faces out).

## Comparison with Chapter 1 (Nell), built while the pipeline was being invented

| | Chapter 1 | Chapter 2 |
|---|---|---|
| Still images generated | 27 (2 scenes redone) | 24 (0 redone) |
| Clips generated | 13 (4 redone) | 10 (0 redone) |
| Media API cost | $4.97 | $4.03 |
| Wall-clock for media | ~2 sessions across 2 days | ~20 minutes |

## What scales and what doesn't

- **Scales:** scene art, animation, looping, packaging, the library entry, validation, and the story-engine behaviour (pickups, cues, fork, puzzle, report) — all driven from one JSON file per book.
- **Still human:** the story itself (reading level, the comprehension puzzle, humour), the ~20 picks, and testing with an actual child. Story writing here took minutes because the template is fixed; a professionally edited text would take longer and cost more, and should.
- **Marginal cost of a book today:** ~$4 of media + ~20 minutes of a curator's attention, on top of writing.
