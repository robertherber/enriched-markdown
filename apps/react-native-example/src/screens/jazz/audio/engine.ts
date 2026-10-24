import {
  AudioContext,
  AudioManager,
  type AnalyserNode,
  type AudioBuffer,
  type AudioBufferSourceNode,
  type GainNode,
} from 'react-native-audio-api';
import { RECORDINGS, previewUrl } from './recordings';
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

export type SoundSource = 'recording' | 'synth';

interface Playback {
  track: TrackId;
  start: number;
  bus: GainNode;
  surface: AudioBufferSourceNode | null;
  stopSource: (at: number) => void;
  // Mastered records sit lower in RMS than the raw synth.
  meterGain: number;
  position: (elapsed: number) => { beat: number; progress: number };
}

// Off-beat eighths land late by the score's swing; everything else is
// played as written.
function swung(beat: number, swing: number) {
  const whole = Math.floor(beat);
  const fraction = beat - whole;
  return whole + (Math.abs(fraction - 0.5) < 1e-3 ? swing : fraction);
}

// One turntable for the whole screen: starting a record stops the one before
// it. A record plays either its real preview or the synthesised combo.
class JazzEngine {
  private ctx: AudioContext | null = null;
  private input!: GainNode;
  // Recordings skip the synth's room and saturation.
  private clean!: GainNode;
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
    this.clean = ctx.createGain();
    this.clean.connect(this.analyser);

    this.noise = whiteNoise(ctx);
    this.surfaceNoise = crackle(ctx);
    this.ctx = ctx;
    return ctx;
  }

  private decoded = new Map<TrackId, Promise<AudioBuffer>>();
  // Bumped on every play and stop, so a preview that finishes loading late
  // does not start over whatever was asked for since.
  private request = 0;
  // Called when a record stops by itself at the end of its preview.
  onEnded: (() => void) | null = null;

  get track() {
    return this.playback?.track ?? null;
  }

  async play(track: TrackId, source: SoundSource) {
    this.stop();
    const request = this.request;
    const ctx = this.context();
    await ctx.resume();
    if (source === 'synth') {
      this.playScore(ctx, track);
      return;
    }
    const buffer = await this.recording(ctx, track);
    if (request !== this.request) return;
    this.playRecording(ctx, track, buffer);
  }

  private recording(ctx: AudioContext, track: TrackId) {
    let buffer = this.decoded.get(track);
    if (!buffer) {
      buffer = previewUrl(track).then(async (url) => {
        const decoded = await ctx.decodeAudioData(url);
        if (!decoded) throw new Error(`Could not decode ${track}`);
        return decoded;
      });
      buffer.catch(() => this.decoded.delete(track));
      this.decoded.set(track, buffer);
    }
    return buffer;
  }

  private surface(ctx: AudioContext, bus: GainNode, level: number) {
    const gain = ctx.createGain();
    gain.gain.value = level;
    const surface = ctx.createBufferSource();
    surface.buffer = this.surfaceNoise;
    surface.loop = true;
    surface.connect(gain);
    gain.connect(bus);
    surface.start(ctx.currentTime);
    return surface;
  }

  private playRecording(
    ctx: AudioContext,
    track: TrackId,
    buffer: AudioBuffer
  ) {
    const { vinyl, sync } = RECORDINGS[track];
    const bus = ctx.createGain();
    bus.gain.value = 0.85;
    bus.connect(this.clean);
    const record = ctx.createBufferSource();
    record.buffer = buffer;
    record.connect(bus);
    const start = ctx.currentTime + 0.1;
    record.start(start);
    record.onEnded = () => {
      if (this.playback?.bus !== bus) return;
      this.stop();
      this.onEnded?.();
    };
    this.playback = {
      track,
      start,
      bus,
      surface: vinyl ? this.surface(ctx, bus, 0.5) : null,
      meterGain: 4.2,
      stopSource: (at) => record.stop(at),
      position: (elapsed) => ({
        beat: sync
          ? (((sync.formBeat + ((elapsed - sync.firstBeat) * sync.bpm) / 60) %
              64) +
              64) %
            64
          : -1,
        progress: Math.min(1, elapsed / buffer.duration),
      }),
    };
  }

  private playScore(ctx: AudioContext, track: TrackId) {
    const score: Score = SCORES[track];
    const bus = ctx.createGain();
    bus.connect(this.input);
    const voices = createVoices(ctx, bus, this.noise);
    const surface = this.surface(ctx, bus, 1);
    const start = ctx.currentTime + 0.15;

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
    this.playback = {
      track,
      start,
      bus,
      surface,
      meterGain: 2.6,
      stopSource: () => clearInterval(timer),
      position: (elapsed) => {
        const beat = ((elapsed * score.bpm) / 60) % score.beats;
        return { beat, progress: beat / score.beats };
      },
    };
  }

  stop() {
    this.request++;
    const playback = this.playback;
    if (!playback || !this.ctx) return;
    this.playback = null;
    const now = this.ctx.currentTime;
    playback.bus.gain.setTargetAtTime(0, now, 0.08);
    playback.stopSource(now + 0.6);
    playback.surface?.stop(now + 0.6);
    setTimeout(() => playback.bus.disconnect(), 700);
  }

  // Where the needle is: the beat for the changes wheel, how far through the
  // side, and the time played.
  position() {
    const playback = this.playback;
    if (!playback || !this.ctx) return null;
    const elapsed = Math.max(0, this.ctx.currentTime - playback.start);
    return { ...playback.position(elapsed), elapsed };
  }

  // A loudness in [0, 1] for meters, from the master output.
  level() {
    if (!this.ctx) return 0;
    this.analyser.getFloatTimeDomainData(this.samples);
    let sum = 0;
    for (let i = 0; i < this.samples.length; i++) {
      sum += this.samples[i]! * this.samples[i]!;
    }
    const gain = this.playback?.meterGain ?? 2.6;
    return Math.min(1, Math.sqrt(sum / this.samples.length) * gain);
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
