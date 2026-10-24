import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import {
  ENVELOPE_RATE,
  jazzEngine,
  type SoundSource,
  type Timeline,
} from './audio/engine';
import type { TrackId } from './audio/scores';
import type { VoiceName } from './audio/synth';

interface Player {
  track: TrackId | null;
  // The record being fetched and decoded before it can start.
  loading: TrackId | null;
  source: SoundSource;
  setSource: (source: SoundSource) => void;
  toggle: (track: TrackId) => void;
  stop: () => void;
  strike: (voice: VoiceName, midis: number[], len?: number) => void;
  // Derived on the UI thread every frame and read there by the turntables,
  // meters and the changes wheel; JS does no per-frame work while a record
  // plays.
  level: SharedValue<number>;
  // The chord of the form playing now, as an index into its chart, or -1.
  chord: SharedValue<number>;
  progress: SharedValue<number>;
  elapsed: SharedValue<number>;
}

const PlayerContext = createContext<Player | null>(null);

// The screen's one turntable. Renderers reach it through context, so a card
// mounted inside the markdown can start a record another card visualises.
export function PlayerProvider({ children }: { children: ReactNode }) {
  const [track, setTrack] = useState<TrackId | null>(null);
  const [loading, setLoading] = useState<TrackId | null>(null);
  const [source, setSourceState] = useState<SoundSource>('recording');
  const loadingRef = useRef<TrackId | null>(null);
  const sourceRef = useRef(source);
  const level = useSharedValue(0);
  const chord = useSharedValue(-1);
  const progress = useSharedValue(0);
  const elapsed = useSharedValue(0);

  const timeline = useSharedValue<Timeline | null>(null);
  // The synth's level, sampled from the analyser a few times a second.
  const liveLevel = useSharedValue(0);

  useEffect(() => {
    const line = track ? jazzEngine.timeline : null;
    timeline.value = line;
    if (!line || line.envelope) return;
    const timer = setInterval(() => {
      liveLevel.value = jazzEngine.level();
    }, 1000 / ENVELOPE_RATE);
    return () => clearInterval(timer);
  }, [track, timeline, liveLevel]);

  useFrameCallback(() => {
    const line = timeline.value;
    if (!line) {
      if (level.value > 0.001) level.value *= 0.88;
      else if (level.value !== 0) level.value = 0;
      if (chord.value !== -1) chord.value = -1;
      return;
    }
    const t = Math.max(0, (Date.now() - line.startedAt) / 1000);
    const pass = line.loops ? t % line.length : Math.min(t, line.length);
    elapsed.value = t;
    progress.value = pass / line.length;
    const changes = line.changes;
    let current = -1;
    if (changes) {
      for (let i = 0; i < changes.length && changes[i]![0] <= pass; i++) {
        current = changes[i]![1];
      }
    }
    if (chord.value !== current) chord.value = current;
    const envelope = line.envelope;
    level.value = envelope
      ? (envelope[
          Math.min(envelope.length - 1, Math.floor(pass * ENVELOPE_RATE))
        ] ?? 0)
      : liveLevel.value;
  });

  useEffect(() => {
    jazzEngine.onEnded = () => setTrack(null);
    return () => {
      jazzEngine.onEnded = null;
      jazzEngine.stop();
    };
  }, []);

  const load = useCallback((next: TrackId | null) => {
    loadingRef.current = next;
    setLoading(next);
  }, []);

  const stop = useCallback(() => {
    jazzEngine.stop();
    load(null);
    setTrack(null);
  }, [load]);

  const toggle = useCallback(
    async (next: TrackId) => {
      if (jazzEngine.track === next || loadingRef.current === next) {
        stop();
        return;
      }
      setTrack(null);
      load(next);
      try {
        await jazzEngine.play(next, sourceRef.current);
      } catch (error) {
        // Offline, or the store has no preview: the sketch stands in.
        console.warn(`[LinerNotes] ${next} preview unavailable`, error);
        if (loadingRef.current === next) await jazzEngine.play(next, 'synth');
      }
      if (loadingRef.current !== next) return;
      load(null);
      if (jazzEngine.track === next) setTrack(next);
    },
    [load, stop]
  );

  const setSource = useCallback(
    (next: SoundSource) => {
      sourceRef.current = next;
      setSourceState(next);
      stop();
    },
    [stop]
  );

  const strike = useCallback(
    (voice: VoiceName, midis: number[], len?: number) =>
      jazzEngine.strike(voice, midis, len),
    []
  );

  const value = useMemo(
    () => ({
      track,
      loading,
      source,
      setSource,
      toggle,
      stop,
      strike,
      level,
      chord,
      progress,
      elapsed,
    }),
    [
      track,
      loading,
      source,
      setSource,
      toggle,
      stop,
      strike,
      level,
      chord,
      progress,
      elapsed,
    ]
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}

export function usePlayer() {
  const player = useContext(PlayerContext);
  if (!player) throw new Error('usePlayer needs a PlayerProvider');
  return player;
}
