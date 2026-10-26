import {
  AudioContext,
  AudioManager,
  type AudioBuffer,
  type AudioBufferSourceNode,
  type GainNode,
} from 'react-native-audio-api';
import { RECORDINGS, previewUrl } from './recordings';
import type { TrackId } from './harmony';
import {
  createVoices,
  crackle,
  roomImpulse,
  softClipCurve,
  whiteNoise,
  type VoiceName,
} from './synth';

// Mastered records sit low in RMS; this brings them up to the meters' range.
const RECORDING_METER_GAIN = 4.2;

export const ENVELOPE_RATE = 30;

// Everything the UI thread needs to follow a record without asking JS: the
// turntables, meters and changes wheel derive their state from it per frame.
export interface Timeline {
  // `Date.now()` when the first sample is heard.
  startedAt: number;
  // Seconds of the preview.
  length: number;
  // When each chord starts, as [seconds, chord index], for the changes
  // wheel; null when there are no changes to follow.
  changes: Array<[number, number]> | null;
  // Loudness per 1 / ENVELOPE_RATE seconds, measured once from the preview.
  envelope: number[];
}

interface Decoded {
  buffer: AudioBuffer;
  envelope: number[];
}

interface Playback {
  track: TrackId;
  bus: GainNode;
  surface: AudioBufferSourceNode | null;
  stopSource: (at: number) => void;
  timeline: Timeline;
}

function loudness(buffer: AudioBuffer) {
  const data = buffer.getChannelData(0);
  const window = Math.floor(buffer.sampleRate / ENVELOPE_RATE);
  const envelope: number[] = [];
  for (let from = 0; from < data.length; from += window) {
    const to = Math.min(data.length, from + window);
    let sum = 0;
    for (let i = from; i < to; i++) sum += data[i]! * data[i]!;
    envelope.push(
      Math.min(1, Math.sqrt(sum / (to - from)) * RECORDING_METER_GAIN)
    );
  }
  return envelope;
}

// One turntable for the whole screen: starting a record stops the one before
// it. Records play Apple's preview; the synth voices only answer one-off
// strikes, like a chord tapped on the wheel.
class JazzEngine {
  private ctx: AudioContext | null = null;
  private input!: GainNode;
  // Recordings skip the synth's room and saturation.
  private clean!: GainNode;
  private noise!: AudioBuffer;
  private surfaceNoise!: AudioBuffer;
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

    this.input.connect(room);
    room.connect(tone);
    tone.connect(shaper);
    shaper.connect(ctx.destination);
    this.clean = ctx.createGain();
    this.clean.connect(ctx.destination);

    this.noise = whiteNoise(ctx);
    this.surfaceNoise = crackle(ctx);
    this.ctx = ctx;
    return ctx;
  }

  private decoded = new Map<TrackId, Promise<Decoded>>();
  // Bumped on every play and stop, so a preview that finishes loading late
  // does not start over whatever was asked for since.
  private request = 0;
  // Called when a record stops by itself at the end of its preview.
  onEnded: (() => void) | null = null;

  get track() {
    return this.playback?.track ?? null;
  }

  get timeline() {
    return this.playback?.timeline ?? null;
  }

  // `Date.now()` at a time on the audio clock.
  private wallClock(ctx: AudioContext, at: number) {
    return Date.now() + (at - ctx.currentTime) * 1000;
  }

  async play(track: TrackId) {
    this.stop();
    const request = this.request;
    const ctx = this.context();
    await ctx.resume();
    const decoded = await this.recording(ctx, track);
    if (request !== this.request) return;
    this.playRecording(ctx, track, decoded);
  }

  // Fetches and decodes every preview ahead of play.
  prefetch() {
    const ctx = this.context();
    for (const track of Object.keys(RECORDINGS) as TrackId[]) {
      this.recording(ctx, track).catch(() => {});
    }
  }

  private recording(ctx: AudioContext, track: TrackId) {
    let buffer = this.decoded.get(track);
    if (!buffer) {
      buffer = previewUrl(track).then(async (url) => {
        const decoded = await ctx.decodeAudioData(url);
        if (!decoded) throw new Error(`Could not decode ${track}`);
        return { buffer: decoded, envelope: loudness(decoded) };
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
    { buffer, envelope }: Decoded
  ) {
    const { vinyl, changes } = RECORDINGS[track];
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
      bus,
      surface: vinyl ? this.surface(ctx, bus, 0.5) : null,
      stopSource: (at) => record.stop(at),
      timeline: {
        startedAt: this.wallClock(ctx, start),
        length: buffer.duration,
        changes: changes ?? null,
        envelope,
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
