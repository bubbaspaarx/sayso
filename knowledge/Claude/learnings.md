# Sayso — Learnings

## Aligner
- A short heard token ("a", "uh") matching a soft expected word must not be allowed to skip hard words. Three "a"s in one sentence turned into a ladder the cursor climbed. Rule: skipping requires a substantive match.
- Stall "attempts" must count only final utterances that ended with unmatched words while parked on the gate, otherwise every gate logs a false attempt on the word before it.
- Pressing Enter to advance can activate whichever button gets autofocus on the next screen. `preventDefault()` on handled keys.

- iOS Safari finalises a segment while a later interim is already in flight. If the feed's "already fed" memory shrinks to the finals on that event, the interim tail is fed twice next time and common words ("the", "she") match the next sentence at the cursor. Never shrink the fed-prefix memory on a confirming final.
- Stopping the engine at "complete" (len-1 / len-3+silence) means the last word is never credited. Keep listening; make completion sticky.
- A corrected re-read of a skipped word often also matches the same word a little further ahead (e.g. "was" twice in two sentences). Check recently-skipped words first; only let the forward aligner see it if it is the exact next word.
- Per-word timestamps are only meaningful between different transcript events; tokens in one HEARD batch share a time. Tag matches with a batch id and skip same-batch gaps.

- Provisional-skip rule needs three cases: same-batch confirmation (skip then next word in one batch → commit now), cross-batch confirmation (first *matched* decision of the next batch is index+1, ignore leading noise), and pickup-word exemption (a gate word is distinctive enough to trust).
- Any test that ends a heard batch on a skip now sees no cursor movement — append the confirming word.
- isComplete refuses while a gate remains, so a passage whose last word is a pickup (p1 "boots") can't use the silence valve. Tests for the valve must use a gate-free passage.

## Image generation (OpenRouter image API)
- Gemini 3.1 Flash Image at ~$0.07/image is good enough for storybook stills; ~$1.85 for nine scenes incl. rejects.
- Say "full-bleed, no border, no frame, no paper edge" or ~half the outputs come with a sketchbook border.
- Pass the anchor still as `input_references` for every other scene; the world stays consistent. Make the "same room, different light" scene as an edit of the anchor still, never a fresh generation.
- Tell it what must NOT be lit (shed windows) — models love a cosy lit window.

## Video generation (OpenRouter video API, Veo 3.1 Lite)
- `POST /api/v1/videos` with `frame_images[{frame_type:"first_frame"}]` accepts a data-URL image. Async: poll `polling_url` until `completed`, download `/videos/{id}/content?index=0`.
- Composition holds well from a first frame; the failure mode is over-interpreting motion words: "fog drifts" → a cloud on the door, "dust motes" → a smoke wisp, "ripple from the frog" → the frog jumps, "curtain stirs" → the curtain falls off. Fix: state explicitly what does not move, name one thing that does, and list the artefacts you don't want ("no smoke, no mist").
- Kling's site has no negative-prompt box any more and blocks free-tier image-to-video; Kling v3 std is on the OpenRouter API at ~$0.67/8s if Veo is ever not enough.
- ffmpeg tail→head xfade (1s) makes acceptable loops; don't upscale low-res clips (`scale='min(1280,iw)':-2`).
- Can't watch video in-session: a `select=not(mod(n,48)),tile=4x1` contact sheet is enough to catch composition drift and unwanted motion.

## Deploy
- Workflow `branches: [main]` on a `master` repo silently deploys nothing; re-running the only existing run just redeploys the old commit. Check `gh run list` for which SHA actually deployed.
- `concurrency: cancel-in-progress` + a manual re-run at the same time = cancelled push run, site stays stale.
- Playwright `click({force:true})` on tiles under an overlay lands on the overlay. Close the debug panel (or don't open it) for automated puzzle flows.

## Curation (chapter 2)
- Second book on the finished pipeline: 24 stills + 10 clips, zero redos, $4.03, ~21 min. The prompt rules learned on chapter 1 (pin statics, no border, no faces, payoff as an edit of the before-scene) transferred completely.
- Bright scenes need a scrim behind the puzzle prompt; the passage gradient alone is enough for the text block but not for centred UI.
- A 2-column candidate sheet (ffmpeg hstack/vstack, built from Python to dodge zsh quoting) reviews 16 images in one look.
- Underwater loops compress worse than night scenes (0.8–1.4 MB vs 0.3–0.8 MB); still under the 3 MB cap.
