import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { ENVELOPE_RATE, jazzEngine, type Timeline } from './audio/engine';
import type { TrackId } from './audio/harmony';
import type { VoiceName } from './audio/synth';

const AUTO_CUE: TrackId = 'blueTrain';

interface PlayerState {
  track: TrackId | null;
  // The record being fetched and decoded before it can start.
  loading: TrackId | null;
}

// Player state lives outside React state, and each card subscribes to the
// slice it shows: switching records re-renders the two cards involved, not
// every card on the screen.
function createStore(initial: PlayerState) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch: Partial<PlayerState>) {
      state = { ...state, ...patch };
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

type Store = ReturnType<typeof createStore>;

interface Player {
  store: Store;
  toggle: (track: TrackId) => void;
  // Called as a record's card arrives; the first one, while the stream has
  // cueing on, starts Blue Train.
  cue: () => void;
  setAutoCue: (on: boolean) => void;
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
  const [store] = useState(() => createStore({ track: null, loading: null }));
  const track = useSyncExternalStore(store.subscribe, () => store.get().track);
  const level = useSharedValue(0);
  const chord = useSharedValue(-1);
  const progress = useSharedValue(0);
  const elapsed = useSharedValue(0);

  const timeline = useSharedValue<Timeline | null>(null);

  useEffect(() => {
    timeline.value = track ? jazzEngine.timeline : null;
  }, [track, timeline]);

  useFrameCallback(() => {
    const line = timeline.value;
    if (!line) {
      if (level.value > 0.001) level.value *= 0.88;
      else if (level.value !== 0) level.value = 0;
      if (chord.value !== -1) chord.value = -1;
      return;
    }
    const t = Math.max(0, (Date.now() - line.startedAt) / 1000);
    const pass = Math.min(t, line.length);
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
    level.value =
      envelope[
        Math.min(envelope.length - 1, Math.floor(pass * ENVELOPE_RATE))
      ] ?? 0;
  });

  useEffect(() => {
    jazzEngine.onEnded = () => store.set({ track: null });
    return () => {
      jazzEngine.onEnded = null;
      jazzEngine.stop();
    };
  }, [store]);

  const stop = useCallback(() => {
    jazzEngine.stop();
    store.set({ track: null, loading: null });
  }, [store]);

  const play = useCallback(
    async (next: TrackId) => {
      if (jazzEngine.track === next || store.get().loading === next) return;
      store.set({ track: null, loading: next });
      try {
        await jazzEngine.play(next);
      } catch (error) {
        // Offline, or the store has no preview.
        console.warn(`[LinerNotes] ${next} preview unavailable`, error);
      }
      if (store.get().loading !== next) return;
      store.set({
        loading: null,
        track: jazzEngine.track === next ? next : null,
      });
    },
    [store]
  );

  const toggle = useCallback(
    (next: TrackId) => {
      if (jazzEngine.track === next || store.get().loading === next) stop();
      else play(next);
    },
    [store, play, stop]
  );

  // Blue Train goes on by itself as its card, the first, lands; the rest wait
  // for a tap so the answer is not cut up by records interrupting each other.
  const autoCue = useRef(false);
  const setAutoCue = useCallback((on: boolean) => {
    autoCue.current = on;
  }, []);
  const cue = useCallback(() => {
    if (!autoCue.current) return;
    autoCue.current = false;
    if (!jazzEngine.track && !store.get().loading) play(AUTO_CUE);
  }, [store, play]);

  // The previews are fetched and decoded up front, so a cued record starts
  // the moment its card lands.
  useEffect(() => {
    jazzEngine.prefetch();
  }, []);

  const strike = useCallback(
    (voice: VoiceName, midis: number[], len?: number) =>
      jazzEngine.strike(voice, midis, len),
    []
  );

  const value = useMemo(
    () => ({
      store,
      toggle,
      cue,
      setAutoCue,
      stop,
      strike,
      level,
      chord,
      progress,
      elapsed,
    }),
    [
      store,
      toggle,
      cue,
      setAutoCue,
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

// The controls and per-frame values, stable for the life of the screen.
export function usePlayer() {
  const player = useContext(PlayerContext);
  if (!player) throw new Error('usePlayer needs a PlayerProvider');
  return player;
}

// One slice of the player state; the caller re-renders only when it changes.
export function usePlayerState<T>(select: (state: PlayerState) => T) {
  const { store } = usePlayer();
  return useSyncExternalStore(store.subscribe, () => select(store.get()));
}
