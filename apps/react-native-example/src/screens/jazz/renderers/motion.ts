import { useEffect } from 'react';
import {
  Easing,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

// A slot mounts a few frames before the host places it on screen, so every
// entrance waits that out instead of spending its first frames off screen.
const PLACEMENT_DELAY = 100;

export const SETTLE = Easing.out(Easing.cubic);
export const OVERSHOOT = Easing.out(Easing.back(1.5));
export const SWING = Easing.inOut(Easing.cubic);

export function useEntrance(duration = 800, delay = 0, easing = SETTLE) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      PLACEMENT_DELAY + delay,
      withTiming(1, { duration, easing })
    );
  }, [progress, duration, delay, easing]);
  return progress;
}

export function formatTime(seconds: number) {
  'worklet';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
