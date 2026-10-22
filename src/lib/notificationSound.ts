/** A short two-tone chime for arriving notifications.
 *
 *  Synthesised with the Web Audio API rather than shipped as an audio file:
 *  nothing to download, nothing to 404, and no binary in the repo. Two
 *  descending bell tones with an exponential decay read as a notification
 *  rather than an alarm.
 *
 *  Browsers block audio until the user has interacted with the page, so the
 *  context is created lazily on first play and failures are swallowed --
 *  a silent notification is fine, a thrown error in a socket handler is not.
 */

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (context) return context;
  try {
    const Ctor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
    return context;
  } catch {
    return null;
  }
}

function tone(ctx: AudioContext, frequency: number, startAt: number, duration: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  // A sine is the closest simple waveform to a struck bell; a square or saw
  // reads as an error buzzer.
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startAt);

  // Quick attack, exponential decay -- the shape of something being struck.
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration);
}

export function playNotificationSound() {
  const ctx = audioContext();
  if (!ctx) return;
  try {
    // Autoplay policy suspends the context until a gesture has happened.
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    // Descending fifth: recognisably a chime, and short enough not to annoy.
    tone(ctx, 988, now, 0.5);          // B5
    tone(ctx, 659, now + 0.11, 0.55);  // E5
  } catch {
    // Sound is a nicety; never let it break the notification itself.
  }
}
