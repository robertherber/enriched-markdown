import {
  AudioContext,
  AudioManager,
  type AnalyserNode,
  type AudioBuffer,
  type AudioBufferSourceNode,
  type GainNode,
} from 'react-native-audio-api';
import { SCORES, type Score, type TrackId } from './scores';
import {
  createVoices,
  crackle,
  roomImpulse,
  softClipCurve,
  whiteNoise,
  type VoiceName,
} from './synth';

const LOOKAHEAD_S = 0.3;
const TICK_MS = 60;

interface Playback {
  track: TrackId;
  score: Score;
  start: number;
  bus: GainNode;
  surface: AudioBufferSourceNode;
  timer: ReturnType<typeof setInterval>;
}

// Off-beat eighths land late by the score's swing; everything else is
// played as written.
function swung(beat: number, swing: number) {
  const whole = Math.floor(beat);
  const fraction = beat - whole;
  return whole + (Math.abs(fraction - 0.5) < 1e-3 ? swing : fraction);
}

// One synthesised combo for the whole screen: starting a record stops the
// one before it, like a single turntable.
class JazzEngine {
  private ctx: AudioContext | null = null;
  private input!: GainNode;
  private analyser!: AnalyserNode;
  private noise!: AudioBuffer;
  private surfaceNoise!: AudioBuffer;
  private samples = new Float32Array(1024);
  private playback: Playback | null = null;

  private context() {
    if (this.ctx) return this.ctx;
    AudioManager.setAudioSessionOptions({
      iosCategory: 'playback',
      iosMode: 'default',
      iosOptions: [],
    });
    const ctx = new AudioContext();
    this.input = ctx.createGain();
    this.input.gain.value = 0.9;

    // One chain, no splits: a node feeding two inputs only reaches the last
    // one in react-native-audio-api 0.13, so the impulse carries the dry
    // signal as well as the room.
    const room = ctx.createConvolver();
    room.normalize = false;
    room.buffer = roomImpulse(ctx);
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 7200;
    const shaper = ctx.createWaveShaper();
    shaper.curve = softClipCurve();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;

    this.input.connect(room);
    room.connect(tone);
    tone.connect(shaper);
    shaper.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    this.noise = whiteNoise(ctx);
    this.surfaceNoise = crackle(ctx);
    this.ctx = ctx;
    return ctx;
  }

  get track() {
    return this.playback?.track ?? null;
  }

  play(track: TrackId) {
    this.stop();
    const ctx = this.context();
    ctx.resume();
    const score = SCORES[track];
    const bus = ctx.createGain();
    bus.connect(this.input);
    const voices = createVoices(ctx, bus, this.noise);

    const surface = ctx.createBufferSource();
    surface.buffer = this.surfaceNoise;
    surface.loop = true;
    surface.connect(bus);
    const start = ctx.currentTime + 0.15;
    surface.start(ctx.currentTime);

    const spb = 60 / score.bpm;
    let loop = 0;
    let cursor = 0;
    const schedule = () => {
      const horizon = ctx.currentTime + LOOKAHEAD_S;
      for (;;) {
        const note = score.notes[cursor]!;
        const from = swung(note.at, score.swing);
        const t = start + (loop * score.beats + from) * spb;
        if (t > horizon) break;
        const len = (swung(note.at + note.len, score.swing) - from) * spb;
        voices[note.voice](t, len, note.midi, note.vel);
        cursor++;
        if (cursor === score.notes.length) {
          cursor = 0;
          loop++;
        }
      }
    };
    schedule();
    const timer = setInterval(schedule, TICK_MS);
    this.playback = { track, score, start, bus, surface, timer };
  }

  stop() {
    const playback = this.playback;
    if (!playback || !this.ctx) return;
    this.playback = null;
    clearInterval(playback.timer);
    const now = this.ctx.currentTime;
    playback.bus.gain.setTargetAtTime(0, now, 0.08);
    playback.surface.stop(now + 0.6);
    setTimeout(() => playback.bus.disconnect(), 700);
  }

  // Where the needle is: beats into the current pass and how far through it.
  position() {
    const playback = this.playback;
    if (!playback || !this.ctx) return null;
    const { score, start } = playback;
    const beats = Math.max(
      0,
      (this.ctx.currentTime - start) * (score.bpm / 60)
    );
    const beat = beats % score.beats;
    return {
      beat,
      progress: beat / score.beats,
      elapsed: beats * (60 / score.bpm),
    };
  }

  // A loudness in [0, 1] for meters, from the master output.
  level() {
    if (!this.ctx) return 0;
    this.analyser.getFloatTimeDomainData(this.samples);
    let sum = 0;
    for (let i = 0; i < this.samples.length; i++) {
      sum += this.samples[i]! * this.samples[i]!;
    }
    return Math.min(1, Math.sqrt(sum / this.samples.length) * 2.6);
  }

  // A one-off strike outside any record, like a chord played on the wheel.
  strike(voice: VoiceName, midis: number[], len = 1.2, vel = 0.9) {
    const ctx = this.context();
    ctx.resume();
    const bus = ctx.createGain();
    bus.connect(this.input);
    const voices = createVoices(ctx, bus, this.noise);
    const t = ctx.currentTime + 0.02;
    midis.forEach((midi, i) => voices[voice](t + i * 0.012, len, midi, vel));
    setTimeout(() => bus.disconnect(), (len + 2) * 1000);
  }
}

export const jazzEngine = new JazzEngine();
