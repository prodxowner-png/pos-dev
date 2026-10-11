/**
 * Audio Feedback Synthesizer for POS Payment Terminal
 * Plays a subtle, crystal-clear 'ping' chime on QR payment confirmation.
 */

let sharedAudioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioContext) {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtxClass) {
      sharedAudioContext = new AudioCtxClass();
    }
  }
  if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch((err) => console.warn('[Audio] Context resume error:', err));
  }
  return sharedAudioContext;
};

/**
 * Plays a pleasant double-tone 'ping' chime upon payment confirmation
 * @param volume - Volume level between 0.0 and 1.0 (default: 0.25)
 */
export const playPaymentConfirmationPing = (volume: number = 0.25): void => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Tone 1: Bright High Bell (C6 - 1046.50 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.50, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(volume * 0.7, now + 0.012);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    // Tone 2: Harmonic Chime (G6 - 1567.98 Hz, delayed by 70ms)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1567.98, now + 0.07);
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.setValueAtTime(0, now + 0.07);
    gain2.gain.linearRampToValueAtTime(volume * 0.9, now + 0.085);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    // Tone 3: High shimmer accent (C7 - 2093.00 Hz, delayed by 130ms)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(2093.00, now + 0.13);
    gain3.gain.setValueAtTime(0, now);
    gain3.gain.setValueAtTime(0, now + 0.13);
    gain3.gain.linearRampToValueAtTime(volume * 0.35, now + 0.145);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

    osc3.connect(gain3);
    gain3.connect(ctx.destination);

    // Start oscillators
    osc1.start(now);
    osc1.stop(now + 0.35);

    osc2.start(now + 0.07);
    osc2.stop(now + 0.48);

    osc3.start(now + 0.13);
    osc3.stop(now + 0.38);
  } catch (err) {
    console.warn('[Payment Audio] Unable to play confirmation ping:', err);
  }
};
