import type {
  AudioBuffer,
  AudioNode,
  BaseAudioContext,
} from 'react-native-audio-api';

// A small jazz combo built from oscillators, filters and noise. Every voice
// schedules its own nodes at `t` (seconds on the context clock) and lets them
// stop themselves, so nothing has to be cleaned up by hand.

export type VoiceName =
  | 'sax'
  | 'piano'
  | 'bass'
  | 'ride'
  | 'hat'
  | 'brush'
  | 'kick'
  | 'tom'
  | 'gong'
  | 'swell'
  | 'buzz';

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

  const sine = (t: number, frequency: number, peak: number, decay: number) => {
    const osc = ctx.createOscillator();
    osc.frequency.value = frequency;
    const gain = env(t, peak, 0.003);
    gain.gain.setTargetAtTime(0, t + 0.003, decay);
    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + decay * 7);
  };

  return {
    // Two reedy saws, a scoop into the pitch, a breathy attack and a vibrato
    // that blooms on longer notes.
    sax(t, len, midi, vel) {
      const f = hz(midi);
      const end = t + len;
      const amp = env(t, 0.15 * vel, 0.035);
      amp.gain.setTargetAtTime(0.115 * vel, t + 0.035, 0.18);
      amp.gain.setTargetAtTime(0, end, 0.045);

      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.Q.value = 1.6;
      tone.frequency.setValueAtTime(f * 2, t);
      tone.frequency.linearRampToValueAtTime(f * 6 * vel + 700, t + 0.05);
      tone.frequency.setTargetAtTime(f * 3.5 + 500, t + 0.05, 0.25);

      const body = ctx.createBiquadFilter();
      body.type = 'peaking';
      body.frequency.value = 1150;
      body.Q.value = 1.3;
      body.gain.value = 6;

      const reed = ctx.createOscillator();
      reed.type = 'sawtooth';
      reed.frequency.value = f;
      const edge = ctx.createOscillator();
      edge.type = 'square';
      edge.frequency.value = f;
      edge.detune.value = -6;
      const edgeGain = ctx.createGain();
      edgeGain.gain.value = 0.28;

      for (const osc of [reed, edge]) {
        osc.detune.setValueAtTime(-40, t);
        osc.detune.linearRampToValueAtTime(osc === edge ? -6 : 0, t + 0.07);
      }

      // One LFO per oscillator: a node feeding two inputs only reaches the
      // last one in react-native-audio-api 0.13.
      if (len > 0.38) {
        for (const osc of [reed, edge]) {
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 5.2;
          const depth = ctx.createGain();
          depth.gain.setValueAtTime(0, t + 0.22);
          depth.gain.linearRampToValueAtTime(16, t + Math.min(len, 0.9));
          lfo.connect(depth);
          depth.connect(osc.detune);
          lfo.start(t);
          lfo.stop(end + 0.4);
        }
      }

      reed.connect(tone);
      edge.connect(edgeGain);
      edgeGain.connect(tone);
      tone.connect(body);
      body.connect(amp);
      amp.connect(out);
      reed.start(t);
      edge.start(t);
      reed.stop(end + 0.4);
      edge.stop(end + 0.4);

      noiseHit(t, 'bandpass', 2400, 0.9, 0.035 * vel, 0.05);
    },

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

    // An upright: a pluck that opens the filter, then a woody sustain.
    bass(t, len, midi, vel) {
      const f = hz(midi);
      const amp = env(t, 0.2 * vel, 0.008);
      amp.gain.setTargetAtTime(0.1 * vel, t + 0.008, 0.14);
      amp.gain.setTargetAtTime(0, t + len * 0.92, 0.05);
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.Q.value = 2;
      tone.frequency.setValueAtTime(f * 12, t);
      tone.frequency.setTargetAtTime(f * 3, t, 0.08);
      const string = ctx.createOscillator();
      string.type = 'triangle';
      string.frequency.value = f;
      const body = ctx.createOscillator();
      body.frequency.value = f;
      string.connect(tone);
      body.connect(tone);
      tone.connect(amp);
      amp.connect(out);
      string.start(t);
      body.start(t);
      string.stop(t + len + 0.5);
      body.stop(t + len + 0.5);
    },

    ride(_t, _len, _midi, vel) {
      noiseHit(_t, 'highpass', 6800, 0.7, 0.024 * vel, 0.22);
      sine(_t, 3180, 0.006 * vel, 0.18);
      sine(_t, 4730, 0.004 * vel, 0.12);
    },

    hat(t, _len, _midi, vel) {
      noiseHit(t, 'highpass', 8200, 1, 0.04 * vel, 0.018);
    },

    brush(t, len, _midi, vel) {
      noiseHit(t, 'bandpass', 2600, 0.6, 0.02 * vel, Math.max(0.05, len), 0.05);
    },

    kick(t, _len, _midi, vel) {
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(95, t);
      osc.frequency.exponentialRampToValueAtTime(48, t + 0.08);
      const gain = env(t, 0.12 * vel, 0.004);
      gain.gain.setTargetAtTime(0, t + 0.004, 0.07);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.6);
    },

    tom(t, _len, midi, vel) {
      const f = hz(midi);
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(f * 1.4, t);
      osc.frequency.exponentialRampToValueAtTime(f, t + 0.06);
      const gain = env(t, 0.16 * vel, 0.004);
      gain.gain.setTargetAtTime(0, t + 0.004, 0.16);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 1.2);
      noiseHit(t, 'lowpass', 1400, 0.7, 0.05 * vel, 0.05);
    },

    // Inharmonic partials that beat against each other and ring for seconds.
    gong(t, len, midi, vel) {
      const f = hz(midi);
      const partials = [1, 1.483, 1.932, 2.546, 2.63, 3.358, 4.1];
      partials.forEach((ratio, i) => {
        const osc = ctx.createOscillator();
        osc.frequency.value = f * ratio;
        const gain = env(t, (0.06 * vel) / (1 + i * 0.6), 0.04 + i * 0.03);
        gain.gain.setTargetAtTime(0, t + 0.1, len / (1 + i * 0.4));
        osc.connect(gain);
        gain.connect(out);
        osc.start(t);
        osc.stop(t + len * 5);
      });
      noiseHit(t, 'lowpass', 900, 0.8, 0.08 * vel, 0.6, 0.01);
    },

    // A cymbal rolled with mallets, rising into the downbeat.
    swell(t, len, _midi, vel) {
      const source = ctx.createBufferSource();
      source.buffer = noise;
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(3000, t);
      filter.frequency.linearRampToValueAtTime(6000, t + len);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.05 * vel, t + len);
      gain.gain.setTargetAtTime(0, t + len, 0.9);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      source.start(t);
      source.stop(t + len + 6);
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
