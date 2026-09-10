let ctx: AudioContext | null = null;

/** Call from a user gesture (Start button) so iOS unlocks audio. */
export function initAudio() {
  if (ctx) return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
}

/** Soft two-note chime, synthesised — no asset needed. */
export function chime() {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const notes = [659.25, 987.77]; // E5, B5
  notes.forEach((freq, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = t0 + i * 0.12;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.7);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(start);
    osc.stop(start + 0.75);
  });
}
