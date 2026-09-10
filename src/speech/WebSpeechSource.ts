import type { SpeechSource, SpeechStatus, Transcript } from "./SpeechSource";

type SR = { new (): SpeechRecognition };

function getCtor(): SR | null {
  const w = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function webSpeechSupported(): boolean {
  return typeof window !== "undefined" && getCtor() !== null;
}

/**
 * Web Speech API source. iOS Safari ends recognition on its own every ~30-60s
 * or after silence; we restart on `onend` while we still want to listen.
 */
export class WebSpeechSource implements SpeechSource {
  readonly name = "WebSpeech";
  restarts = 0;
  private rec: SpeechRecognition | null = null;
  private wantListening = false;
  private transcriptCb: (t: Transcript) => void = () => {};
  private statusCb: (s: SpeechStatus) => void = () => {};
  private restartTimer: number | null = null;

  onTranscript(cb: (t: Transcript) => void) {
    this.transcriptCb = cb;
  }
  onStatus(cb: (s: SpeechStatus) => void) {
    this.statusCb = cb;
  }

  async start(): Promise<void> {
    const Ctor = getCtor();
    if (!Ctor) {
      this.statusCb("unsupported");
      return;
    }
    this.wantListening = true;
    this.restarts = -1; // first start is not a restart
    this.spawn(Ctor);
  }

  stop(): void {
    this.wantListening = false;
    if (this.restartTimer) window.clearTimeout(this.restartTimer);
    try {
      this.rec?.stop();
    } catch {
      /* already stopped */
    }
    this.rec = null;
    this.statusCb("stopped");
  }

  private spawn(Ctor: SR) {
    if (!this.wantListening) return;
    this.restarts++;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-GB";
    rec.maxAlternatives = 1;

    rec.onstart = () => this.statusCb("listening");

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const text = res[0]?.transcript ?? "";
        if (res.isFinal) this.transcriptCb({ text, isFinal: true });
        else interim += " " + text;
      }
      if (interim.trim()) this.transcriptCb({ text: interim.trim(), isFinal: false });
    };

    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        this.wantListening = false;
        this.statusCb("denied");
        return;
      }
      if (ev.error === "no-speech" || ev.error === "aborted" || ev.error === "network") {
        // Normal on iOS. onend follows; we restart there.
        return;
      }
      this.statusCb("error");
    };

    rec.onend = () => {
      this.rec = null;
      if (this.wantListening) {
        // Restart immediately; a tiny delay avoids a tight loop if start() throws.
        this.restartTimer = window.setTimeout(() => this.spawn(Ctor), 50);
      } else {
        this.statusCb("stopped");
      }
    };

    this.rec = rec;
    try {
      rec.start();
    } catch {
      // "already started" — retry shortly
      this.restartTimer = window.setTimeout(() => this.spawn(Ctor), 300);
    }
  }
}
