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
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { jazzEngine, type SoundSource } from './audio/engine';
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
  // Read on the UI thread by the turntables, meters and the changes wheel.
  level: SharedValue<number>;
  beat: SharedValue<number>;
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
  const beat = useSharedValue(-1);
  const progress = useSharedValue(0);
  const elapsed = useSharedValue(0);

  useEffect(() => {
    if (!track) {
      level.value = withTiming(0, { duration: 400 });
      beat.value = -1;
      return;
    }
    let frame = requestAnimationFrame(function sample() {
      const position = jazzEngine.position();
      if (position) {
        beat.value = position.beat;
        progress.value = position.progress;
        elapsed.value = position.elapsed;
      }
      level.value = jazzEngine.level();
      frame = requestAnimationFrame(sample);
    });
    return () => cancelAnimationFrame(frame);
  }, [track, level, beat, progress, elapsed]);

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
      beat,
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
      beat,
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
