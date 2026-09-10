export type SpeechStatus = "listening" | "stopped" | "denied" | "error" | "unsupported";

export type Transcript = { text: string; isFinal: boolean };

export interface SpeechSource {
  start(): Promise<void>;
  stop(): void;
  onTranscript(cb: (t: Transcript) => void): void;
  onStatus(cb: (s: SpeechStatus) => void): void;
  /** Diagnostics for the debug panel. */
  readonly restarts: number;
  readonly name: string;
}
