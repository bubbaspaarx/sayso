import type { SpeechStatus } from "../speech/SpeechSource";

const LABEL: Record<SpeechStatus, string> = {
  listening: "Listening",
  stopped: "Not listening",
  denied: "Mic blocked",
  error: "Mic problem",
  unsupported: "No mic support",
};

export function MicIndicator({ status }: { status: SpeechStatus }) {
  const dot =
    status === "listening" ? "bg-amber animate-pulse" : status === "stopped" ? "bg-white/40" : "bg-red-400";
  return (
    <div className="flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-sm font-bold text-white/80">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} />
      {LABEL[status]}
    </div>
  );
}
