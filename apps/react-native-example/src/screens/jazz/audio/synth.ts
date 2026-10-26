import type {
  AudioBuffer,
  AudioNode,
  BaseAudioContext,
} from 'react-native-audio-api';

// The one-off sounds tapped out on the cards: a piano chord on the changes
// wheel and the hum of the Vanguard's neon. Each voice schedules its own
// nodes at `t` (seconds on the context clock) and lets them stop themselves,
// so nothing has to be cleaned up by hand.

export type VoiceName = 'piano' | 'buzz';

export type Voice = (t: number, len: number, midi: number, vel: number) => void;

export function hz(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function filledBuffer(
  ctx: BaseAudioContext,
  seconds: number,
  channels: number,
  sample: (i: number, channel: number, length: number) => number
): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(channels, length, ctx.sampleRate);
  for (let channel = 0; channel < channels; channel++) {
    const data = new Float32Array(length);
    for (let i = 0; i < length; i++) data[i] = sample(i, channel, length);
    buffer.copyToChannel(data, channel);
  }
  return buffer;
}

export function whiteNoise(ctx: BaseAudioContext) {
  return filledBuffer(ctx, 2, 1, () => Math.random() * 2 - 1);
}

// A small room with the dry signal folded in: a unit impulse, then decaying
// stereo noise scaled to `wet` of the direct sound's energy.
export function roomImpulse(ctx: BaseAudioContext, wet = 0.3, seconds = 2.2) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const shape = (i: number) => (1 - i / length) ** 3.2;
  let energy = 0;
  for (let i = 1; i < length; i++) energy += shape(i) ** 2 / 3;
  const scale = wet / Math.sqrt(energy);
  return filledBuffer(ctx, seconds, 2, (i) =>
    i === 0 ? 1 : (Math.random() * 2 - 1) * shape(i) * scale
  );
}

// Surface noise of an old pressing: a low hiss, soft ticks and the odd pop.
export function crackle(ctx: BaseAudioContext) {
  let hiss = 0;
  let pop = 0;
  return filledBuffer(ctx, 5, 1, () => {
    hiss = hiss * 0.92 + (Math.random() * 2 - 1) * 0.08;
    const roll = Math.random();
    if (roll < 0.00012) pop = 0.9;
    else if (roll < 0.0012) pop = 0.22 * Math.random();
    pop *= 0.55;
    return hiss * 0.05 + pop * (Math.random() > 0.5 ? 1 : -1);
  });
}

export function softClipCurve() {
  const curve = new Float32Array(1025);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(1.4 * x) / Math.tanh(1.4);
  }
  return curve;
}

export function createVoices(
  ctx: BaseAudioContext,
  out: AudioNode,
  noise: AudioBuffer
): Record<VoiceName, Voice> {
  const env = (t: number, peak: number, attack: number) => {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    return gain;
  };

  const noiseHit = (
    t: number,
    type: 'highpass' | 'bandpass' | 'lowpass',
    frequency: number,
    q: number,
    peak: number,
    decay: number,
    attack = 0.002
  ) => {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = env(t, peak, attack);
    gain.gain.setTargetAtTime(0, t + attack, decay);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    const offset = Math.random() * 1.5;
    source.start(t, offset);
    source.stop(t + attack + decay * 6);
  };

  return {
    // Hammer-bright, then a long felt decay.
    piano(t, len, midi, vel) {
      const f = hz(midi);
      const amp = env(t, 0.05 * vel, 0.004);
      amp.gain.setTargetAtTime(0.025 * vel, t + 0.004, 0.25);
      amp.gain.setTargetAtTime(0, t + len, 0.12);
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.setValueAtTime(f * 9 + 1200, t);
      tone.frequency.setTargetAtTime(f * 3 + 400, t, 0.3);
      const fundamental = ctx.createOscillator();
      fundamental.type = 'triangle';
      fundamental.frequency.value = f;
      const octave = ctx.createOscillator();
      octave.frequency.value = f * 2.003;
      const octaveGain = ctx.createGain();
      octaveGain.gain.value = 0.35;
      fundamental.connect(tone);
      octave.connect(octaveGain);
      octaveGain.connect(tone);
      tone.connect(amp);
      amp.connect(out);
      fundamental.start(t);
      octave.start(t);
      fundamental.stop(t + len + 0.8);
      octave.stop(t + len + 0.8);
    },

    // Mains hum through a transformer as a neon tube strikes.
    buzz(t, len, _midi, vel) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 120;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      filter.Q.value = 1.5;
      const gain = env(t, 0.03 * vel, 0.01);
      gain.gain.setTargetAtTime(0.012 * vel, t + 0.01, 0.1);
      gain.gain.setTargetAtTime(0, t + len, 0.06);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + len + 0.5);
      noiseHit(t, 'highpass', 3000, 0.7, 0.06 * vel, 0.01);
    },
  };
}
