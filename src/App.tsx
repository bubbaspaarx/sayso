import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { loadChapter } from "./content/loadChapter";
import type { Chapter } from "./content/schema";
import { initialState, reducer } from "./engine/story";
import { WebSpeechSource } from "./speech/WebSpeechSource";
import { TranscriptFeed } from "./speech/TranscriptFeed";
import type { SpeechSource, SpeechStatus } from "./speech/SpeechSource";
import { chime, initAudio } from "./audio/chime";
import { Title } from "./screens/Title";
import { Passage } from "./screens/Passage";
import { Choice } from "./screens/Choice";
import { PuzzleScreen } from "./screens/Puzzle";
import { Hint } from "./screens/Hint";
import { End } from "./screens/End";
import { ReportScreen } from "./screens/Report";
import { DebugPanel } from "./components/DebugPanel";

const params = new URLSearchParams(window.location.search);
const loaded = loadChapter(params.get("chapter") ?? "chapter-01");
const SILENCE_MS = 2500;

export default function App() {
  if ("error" in loaded) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        <pre className="whitespace-pre-wrap rounded-xl bg-red-950/60 p-6 text-red-200">Chapter failed to load:{"\n"}{loaded.error}</pre>
      </div>
    );
  }
  return <Reader />;
}

function Reader() {
  const chapter = (loaded as { chapter: Chapter }).chapter;
  const [state, dispatch] = useReducer(reducer, chapter, (ch) => initialState(ch, params.get("debug") === "1"));
  const [status, setStatus] = useState<SpeechStatus>("stopped");
  const [transcript, setTranscript] = useState({ finalText: "", interimText: "" });
  const speech = useRef<SpeechSource | null>(null);
  const feed = useRef<TranscriptFeed | null>(null);
  const lastHeardAt = useRef<number>(Date.now());

  // Wire speech once.
  useEffect(() => {
    const src = new WebSpeechSource();
    const f = new TranscriptFeed((tokens, isFinal) => {
      const at = Date.now();
      lastHeardAt.current = at;
      dispatch({ type: "HEARD", tokens, isFinal, at });
    });
    src.onStatus(setStatus);
    src.onTranscript((t) => {
      f.push(t);
      setTranscript({ finalText: f.finalText, interimText: f.interimText });
    });
    speech.current = src;
    feed.current = f;
    return () => src.stop();
  }, []);

  const start = useCallback(() => {
    initAudio();
    feed.current?.reset();
    void speech.current?.start();
    dispatch({ type: "START" });
  }, []);

  // Stop listening at the end; resume on restart via Start.
  useEffect(() => {
    if (state.screen === "end") speech.current?.stop();
  }, [state.screen]);

  // Silence valve: 2.5s without heard tokens near the end of a passage.
  const { screen } = state;
  const { cursor, complete } = state.reading;
  useEffect(() => {
    if (screen !== "passage" || complete) return;
    lastHeardAt.current = Date.now();
    const t = window.setTimeout(() => dispatch({ type: "SILENCE", ms: SILENCE_MS }), SILENCE_MS);
    return () => window.clearTimeout(t);
  }, [screen, cursor, complete]);

  // Pickup spectacle: chime + settle animation.
  useEffect(() => {
    if (!state.justPicked) return;
    chime();
    const t = window.setTimeout(() => dispatch({ type: "PICK_ANIM_DONE" }), 600);
    return () => window.clearTimeout(t);
  }, [state.justPicked]);

  // Keyboard driver for testing without speech.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        dispatch({ type: "DEBUG_ADVANCE" });
      } else if (e.key === "Enter") {
        e.preventDefault(); // never let Enter also "click" whatever button gets focus after the state change
        if (state.screen === "title") start();
        else if (state.screen === "passage") dispatch({ type: "NEXT" });
        else if (state.screen === "puzzle" && state.puzzle?.success) dispatch({ type: "PUZZLE_CONTINUE" });
        else if (state.screen === "hint") dispatch({ type: "HINT_DISMISS" });
        else if (state.screen === "end") dispatch({ type: "RESTART" });
        else if (state.screen === "report") dispatch({ type: "REPORT_CLOSE" });
      } else if (e.key === "x") {
        dispatch({ type: "DEBUG_SKIP" });
      } else if (e.key === "d" && e.shiftKey) {
        dispatch({ type: "TOGGLE_DEBUG" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.screen, state.puzzle?.success, start]);

  const passage = state.chapter.passages[state.reading.passageId];

  let view: React.ReactNode;
  switch (state.screen) {
    case "title":
      view = <Title chapter={state.chapter} onStart={start} onTripleTap={() => dispatch({ type: "TOGGLE_DEBUG" })} />;
      break;
    case "passage":
      view = (
        <Passage
          state={state}
          status={status}
          onNext={() => dispatch({ type: "NEXT" })}
          onCueExpire={(now) => dispatch({ type: "CUE_EXPIRE", now })}
        />
      );
      break;
    case "choice":
      view = (
        <Passage
          state={state}
          status={status}
          onNext={() => {}}
          dim
          overlay={<Choice passage={passage} onChoose={(next) => dispatch({ type: "CHOOSE", next })} />}
        />
      );
      break;
    case "puzzle":
      view = (
        <PuzzleScreen
          state={state}
          onToggle={(itemId) => dispatch({ type: "PUZZLE_TOGGLE", itemId })}
          onTry={() => dispatch({ type: "PUZZLE_TRY" })}
          onContinue={() => dispatch({ type: "PUZZLE_CONTINUE" })}
        />
      );
      break;
    case "hint":
      view = <Hint state={state} onDismiss={() => dispatch({ type: "HINT_DISMISS" })} />;
      break;
    case "end":
      view = <End onAgain={() => dispatch({ type: "RESTART" })} onReport={() => dispatch({ type: "REPORT_OPEN" })} />;
      break;
    case "report":
      view = <ReportScreen state={state} onClose={() => dispatch({ type: "REPORT_CLOSE" })} />;
      break;
  }

  return (
    <div className="h-full w-full">
      {view}
      {state.debugPanel && (
        <DebugPanel
          state={state}
          speechName={speech.current?.name ?? "—"}
          status={status}
          restarts={speech.current?.restarts ?? 0}
          finalText={transcript.finalText}
          interimText={transcript.interimText}
          onClose={() => dispatch({ type: "TOGGLE_DEBUG" })}
        />
      )}
    </div>
  );
}
