# Nell Reading MVP — Project Brief

## What this is

A prototype that tests one thesis: **reading is the game.**

A child (~7) reads a short chapter aloud from a tablet. The app listens, follows
along word by word, and treats correctly-read words as game input. Reading the
word "lantern" is what puts the lantern in Nell's bag. At the end of the chapter
there is a puzzle that can only be solved by having actually understood and
remembered what was read. The reward for finishing is finishing.

This is NOT a pronunciation scorer, NOT a points/streak app, NOT an audiobook.
The screen shows the text; the child does the reading.

The prototype must answer one question: **does the child ask to play it again?**

## Non-goals (do not build these)

- Accounts, login, subscriptions, parent dashboard
- Pronunciation scoring or fluency metrics shown to the child
- More than one chapter
- Android or desktop polish — target is iPad Safari, secondary is Chrome desktop
- Ambient soundtrack / SFX (deliberately excluded for v1; may distract from decoding)
- Backend of any kind. Fully static. Child audio never leaves the device.

## Stack

- Vite + React + TypeScript. No framework beyond that.
- Tailwind for styling.
- No state library; `useReducer` for the story engine.
- Content is a static JSON file in `content/`. The engine must be content-agnostic:
  a second chapter should be a new JSON file and nothing else.
- Speech via an abstracted `SpeechSource` interface (below). First implementation
  is the Web Speech API. Design so a local Whisper (transformers.js / WebGPU) can
  be swapped in later without touching the engine.

## Content schema

See `content/chapter-01.json` for the real chapter. Shape:

```ts
type Chapter = {
  id: string;
  title: string;
  series: string;
  start: string;                       // passage id
  items: Item[];                       // everything that can end up in the bag
  passages: Record<string, Passage>;
  puzzles: Record<string, Puzzle>;
  tolerantTokens?: string[];           // hard proper nouns the aligner may skip freely
};

type Item = { id: string; label: string; emoji: string };

type Passage = {
  scene: string;                       // key into media map (video loop or still)
  text: string;                        // exactly what the child reads
  pickups?: { itemId: string; match: string }[]; // fire when `match` token is READ in this passage
  next?: string;                       // linear continuation
  choice?: {                           // branch — shown after passage is read
    prompt: string;
    options: { label: string; next: string }[];
  };
  puzzle?: string;                     // puzzle id — shown after passage is read
};

type Puzzle = {
  id: string;
  type: "pick-set";                    // only type in v1
  prompt: string;
  correct: string[];                   // item ids, order-insensitive
  pickCount: number;
  onSuccess: string;                   // passage id
  hintAfterAttempts: number;
  hintPassage: string;                 // passage to re-show as the hint
  wrongFeedback: string;
};
```

Pickups only fire on the passage where they are declared. The word "lantern" in
Grandma Fen's instructions does NOT collect the lantern; the word "lantern" in
the kitchen does. This is intentional — it is what makes the puzzle a
comprehension test rather than a vocabulary test.

## Screens / flow

1. **Title** — chapter title, one big "Start reading" button. This button is the
   user gesture that unlocks the microphone (Safari requires it).
2. **Passage** — the core screen.
   - Full-bleed scene media behind a dark gradient; text panel on top, large
     (min 28px on iPad), high contrast, generous line height, max ~8 lines.
   - Words render as individual spans. Three states: `unread`, `current`
     (subtle underline/pulse), `read` (brighter). Progress is visible in the
     text itself — this karaoke effect IS the feedback loop. No progress bar.
   - Bag: a row of item slots at the bottom. When a pickup fires, the item
     animates into a slot (scale + settle, ~400ms) with a soft chime. This is
     the one moment of spectacle per pickup; don't overdo it.
   - When the passage is complete (see alignment rules), show a "Next" button.
     Do not auto-advance — the child should feel they finished it.
   - Mic indicator: small, honest. Listening / not listening / no permission.
3. **Choice** — the passage text stays visible (dimmed). Two large buttons.
   Nothing else. No hint. If the child picks wrong, the story handles it.
4. **Puzzle (pick-set)** — prompt at top, the bag's items as large tappable
   tiles, selected tiles highlighted, a "Try" button enabled at `pickCount`.
   - Wrong: `wrongFeedback` shown, tiles reset, no penalty.
   - After `hintAfterAttempts` wrong tries: show `hintPassage` text in a card
     (read-only, not spoken) with a "Got it" button, then return to the puzzle.
   - Right: brief success moment, then advance to `onSuccess`.
5. **End** — "You did it." One button: "Read it again." Nothing else.

## Speech: the SpeechSource interface

```ts
interface SpeechSource {
  start(): Promise<void>;
  stop(): void;
  onTranscript(cb: (t: { text: string; isFinal: boolean }) => void): void;
  onStatus(cb: (s: "listening" | "stopped" | "denied" | "error") => void): void;
}
```

### WebSpeechSource (v1)

- `webkitSpeechRecognition` / `SpeechRecognition`, `continuous = true`,
  `interimResults = true`, `lang = "en-GB"`.
- **iOS Safari WILL stop recognition on its own** every ~30–60s or after
  silence. On `onend`, if the engine still wants to listen, restart it
  immediately. Treat this as normal, not an error.
- On `onerror` with `no-speech`, restart silently. On `not-allowed`, surface
  `denied`.
- Feed BOTH interim and final results to the aligner. Interim results are
  what make it feel responsive.

## Alignment: the core algorithm

We are not transcribing. We know the expected text. This is alignment.

**Setup per passage**
- Tokenise `passage.text` into `expected: Token[]` — lowercase, strip
  punctuation, keep apostrophes inside words. Keep a map from token index back
  to the rendered span.
- `cursor = 0` (index of next expected token).
- Mark tokens in `tolerantTokens` (and any token with ≤2 chars) as `soft`.

**On each transcript event**
- Tokenise the transcript the same way. Take the LAST `W = 12` tokens as
  `heard` (earlier words are already consumed or irrelevant).
- Consider the window `expected[cursor .. cursor + 8]`.
- Find the best monotonic alignment of `heard` against that window:
  - Two tokens match if normalised-Levenshtein similarity ≥ 0.75, or if both
    are in a small homophone/ASR-confusion table (`to/two/too`, `their/there`,
    `nell/now/knell`, etc.). Keep this table in a separate file; you will
    grow it from testing.
  - Allow skipping up to 2 consecutive expected tokens (child skipped a word).
    Soft tokens can be skipped for free.
  - Never move the cursor backwards. If the child repeats a sentence, the
    window still contains their current position; repeated words just fail
    to advance and that is fine.
- Advance `cursor` to one past the furthest expected token that was
  **matched** (not skipped) with confidence.
- Debounce visual updates to ~100ms so interim flicker doesn't jitter.

**Pickups**
- When `cursor` advances past a token whose index is a declared pickup for
  this passage, fire the pickup — but ONLY if that token was matched, not
  skipped. If the child mumbles past "lantern", they don't get the lantern.
  This is the whole point. They can go back and say it.
- A pickup fires once per passage visit.

**Completion**
- Passage is complete when `cursor >= expected.length - 1` (last token may be
  swallowed by ASR).
- Also complete if `cursor >= expected.length - 3` AND 2.5s of silence follow.
  Safety valve for trailing words ASR refuses to hear.

**Do not** attempt to score pronunciation. Match or don't match. That's it.

## Debug panel (mandatory)

Toggle with a triple-tap on the title or `?debug=1`. Shows:
- live raw transcript (interim in grey, final in white)
- `cursor` / `expected.length`
- last alignment decision (which heard tokens matched which expected tokens)
- pickup log
- SpeechSource status and restart count

You cannot tune the aligner without this. Build it in the first session.

## Visuals

- `media/` holds one file per `scene`: prefer a 6–8s looping MP4 (h264, muted,
  `playsinline`, ≤3MB), fall back to a JPG with a slow CSS pan.
- A `mediaMap.ts` maps scene → file. Missing scene → dark blue gradient.
  Never block on media.
- Dark gradient overlay (bottom 70%) so text is always readable.
- Palette: deep navy background, warm amber for `read` text and UI accents,
  Felix blue (`#5BB7FF`-ish) for glow moments only. Don't use the blue for
  anything but Felix.
- Typography: a rounded, highly legible sans (e.g. Nunito / Andika). Never a
  display face for body text.

## Acceptance criteria

1. On an iPad (Safari), a 7-year-old can read the whole chapter aloud and the
   text follows them, with the cursor recovering from at least one skipped
   word and one repeated sentence without intervention.
2. All six pickups fire when read, none fire when skipped.
3. The choice branch loops correctly on the wrong option.
4. The puzzle accepts the correct set in any order and rejects any other set.
5. Hint appears after the configured number of wrong attempts.
6. No network requests after initial load. No audio leaves the device.
7. Debug panel works.
8. Chapter JSON can be swapped for another file with the same schema and the
   app runs without code changes.

## Build order

1. Vite + React + TS scaffold. Load and validate `chapter-01.json` (zod).
2. Story engine reducer: passage → choice → passage → puzzle → passage → end.
   Drive it with a keyboard shortcut (space = "pretend next word read") so the
   whole flow is testable before any speech exists.
3. Passage screen with word spans and the three states. Bag row.
4. `SpeechSource` interface + `WebSpeechSource` + debug panel.
5. Aligner. Unit-test it with fixture transcripts (see `aligner.test.ts`
   suggestions below) before wiring to live speech.
6. Pickups + chime. Choice screen. Puzzle screen. End screen.
7. Media loop + overlay. Only now.
8. iPad testing with a real child. Grow the confusion table from the debug log.

**Aligner test fixtures to write first**
- exact read
- one skipped word mid-sentence
- child repeats a sentence
- ASR mishears one word (e.g. "lantern" → "lantern", "lantern" → "landed")
- long silence then continues
- "Luminis Radix" mangled completely

## Testing protocol (for the human, not the code)

- One child, one iPad, propped on a table at chin height, quiet room.
- Do not touch the iPad during the read. Do not correct pronunciation.
- Film it (their reaction, not the screen).
- Note every place the cursor stalled. That is the tuning backlog.
- The only metric that matters: at "You did it", do they say "again?"

## Decisions log

**2026-09-10 — before first build**

1. **Audio leaves the device in v1.** The Web Speech API sends audio to Apple's
   (Safari) or Google's (Chrome) recognition service and gives no on-device
   control. Accepted for the prototype. Acceptance criterion 6 is read as "no
   network requests after load *other than the browser's own speech service*."
   Likely next step after the web test is a native Swift prototype, where
   on-device `SFSpeechRecognizer` closes this gap properly.
2. **Hosting: GitHub Pages.** iOS Safari only grants the mic on HTTPS, so a
   LAN dev server is not enough. `.github/workflows/deploy.yml` builds and
   deploys on push to `main`. Hetzner/Heroku remain fallbacks.
3. **Pickup words are gates, not skips.** The cursor never advances past a
   pickup word until that word is matched. There is no going back later; the
   word is earned in the moment, which is how a teacher would wait on it.
   Ordinary words keep the skip allowance (≤2 consecutive hard tokens) for
   ASR resilience. If a gate stalls, its match threshold loosens (0.75 → 0.6
   after 3 failed final utterances → 0.5 after 6) rather than being skipped,
   and the stall is logged in the debug panel. The safety-valve completion
   rule never bypasses a gate.

**2026-09-12 — after the first child read**

4. **Skipped words are shown, and a corrected re-read recovers them.** The
   cursor still moves on past a misread (skip allowance stays), but the word
   gets a dotted rose underline. If the child then says that word (within ~12
   tokens), it turns read without the cursor moving back. Recovery beats a
   forward match that would need a skip; the exact next word still wins.
5. **Reading report, adult-facing only.** Behind a small "For grown-ups"
   button on the End screen, never on the child's path. Words heard / not
   heard / corrected, accuracy, words to practise, and an *estimated*
   full-stop pause count from per-word timestamps. "Copy details" dumps the
   report plus the event log for pasting into a Claude session.
6. **Keep listening after completion.** The safety-valve completion no longer
   stops the engine, so a swallowed tail still gets credited.

## Where things are

- `content/chapter-01.json` — the chapter. Any `content/*.json` is loadable via `?chapter=<stem>`.
- `src/engine/` — `tokenise.ts`, `confusions.ts` (grow this from testing), `aligner.ts`, `story.ts` (reducer).
- `src/speech/` — `SpeechSource.ts` interface, `WebSpeechSource.ts`, `TranscriptFeed.ts` (diffs interim/final into new tokens, 100ms debounce).
- `src/screens/`, `src/components/` — UI. `src/media/mediaMap.ts` — scene → `public/media/<scene>.mp4|jpg`.
- Debug panel: `?debug=1`, triple-tap the title, or Shift+D. Keys: space = pretend next word, x = pretend the next word was mumbled, Enter = Next/continue.
- `npm test` runs the aligner fixtures and a full story-flow test. CI runs tests before deploy.
- Media pipeline: `npm run stills` (OpenRouter image API → `media-src/candidates/`), `npm run clips` (OpenRouter video API, Veo 3.1 Lite by default → `media-src/clips/`), `npm run media` (loop + compress + poster → `public/media/`). Prompts live in `VIDEO_PROMPTS.md`; key in `.env`.
- Task tracking: `Code.nosync/Workboard/Sayso/` (Obsidian vault). Session notes: `knowledge/Claude/{active,decisions,learnings}.md` — read `active.md` at session start.
