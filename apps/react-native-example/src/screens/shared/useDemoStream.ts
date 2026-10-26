import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  scrollTo,
  useAnimatedRef,
  useFrameCallback,
  useScrollOffset,
  useSharedValue,
} from 'react-native-reanimated';

const TICK_MS = 34;
const CHARS_PER_TICK = 3;
const BLOCK_PAUSE_MS = 900;
const START_DELAY_MS = 900;
// Time constant of the auto-scroll easing towards the bottom.
const FOLLOW_MS = 140;
// How close to the bottom a drag has to end to pick the follow up again.
const REJOIN_PX = 24;

// Stands in for #830 until the library closes open emphasis while streaming:
// the paragraph being written gets its `**`/`*` closed, so bold and italic
// grow in place instead of showing raw markers. A marker cut off at the tail,
// or a space before the closer (not right-flanking), waits for the next tick.
export function closeOpenEmphasis(text: string) {
  const body = text.replace(/\*+$/, '');
  const paragraph = body.slice(body.lastIndexOf('\n\n') + 1);
  const open: string[] = [];
  for (const [run] of paragraph.matchAll(/\*+/g)) {
    if (open[open.length - 1] === run) open.pop();
    else open.push(run);
  }
  return open.length === 0 ? body : body.trimEnd() + open.reverse().join('');
}

const BLOCK_LINE = /^\n*(!\[|\[|<video)/;

// Lines that become a renderer arrive in one tick, like a model finishing a
// URL, and the stream breathes afterwards so the block can make its entrance.
export function nextCursor(source: string, cursor: number) {
  let start = cursor;
  while (source[start] === '\n') start++;
  const atLineStart = start === 0 || source[start - 1] === '\n';
  if (atLineStart && BLOCK_LINE.test(source.slice(start))) {
    const end = source.indexOf('\n', start);
    return { cursor: end === -1 ? source.length : end + 1, pause: true };
  }
  // Text stops at the start of a renderer line rather than stepping into it,
  // so the next tick takes the whole line.
  let end = Math.min(cursor + CHARS_PER_TICK, source.length);
  for (let i = source.indexOf('\n', cursor); i !== -1 && i < end; ) {
    if (BLOCK_LINE.test(source.slice(i + 1))) {
      end = i + 1;
      break;
    }
    i = source.indexOf('\n', i + 1);
  }
  return { cursor: end, pause: false };
}

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

// Streams `source` like a model answer, `startDelay` ms after the prompt, and
// keeps the scroll view following the bottom until the reader drags away.
export function useDemoStream(source: string, startDelay = START_DELAY_MS) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const following = useSharedValue(true);
  const viewport = useSharedValue(0);
  const target = useSharedValue(0);
  const offset = useSharedValue(0);
  const scrolled = useScrollOffset(scrollRef);
  const [run, setRun] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [detached, setDetached] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let position = 0;
    const tick = () => {
      const next = nextCursor(source, position);
      position = next.cursor;
      setCursor(position);
      if (position < source.length) {
        timer = setTimeout(tick, next.pause ? BLOCK_PAUSE_MS : TICK_MS);
      }
    };
    timer = setTimeout(tick, startDelay);
    return () => clearTimeout(timer);
  }, [source, run, startDelay]);

  // Eases towards the bottom on the UI thread, so the follow stays smooth however
  // often the stream ticks or a block grows the content.
  useFrameCallback(({ timeSincePreviousFrame }) => {
    if (!following.value) return;
    const gap = target.value - offset.value;
    if (Math.abs(gap) < 0.5) return;
    const elapsed = timeSincePreviousFrame ?? 16;
    offset.value += gap * (1 - Math.exp(-elapsed / FOLLOW_MS));
    scrollTo(scrollRef, 0, offset.value, false);
  });

  const follow = useCallback(() => {
    offset.value = scrolled.value;
    following.value = true;
    setDetached(false);
  }, [offset, scrolled, following]);

  // The follow's own scrollTo ends a momentum scroll on iOS too, so only a
  // detached view rejoins.
  const rejoinAtBottom = useCallback(
    (event: ScrollEvent) => {
      const y = event.nativeEvent.contentOffset.y;
      if (!following.value && y >= target.value - REJOIN_PX) follow();
    },
    [following, target, follow]
  );

  // Leaves the follow for a place in the answer, as a drag would.
  const jump = useCallback(
    (y: number) => {
      following.value = false;
      setDetached(true);
      scrollRef.current?.scrollTo({ y, animated: true });
    },
    [following, scrollRef]
  );

  const replay = useCallback(() => {
    following.value = true;
    target.value = 0;
    offset.value = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    setDetached(false);
    setCursor(0);
    setRun((value) => value + 1);
  }, [following, target, offset, scrollRef]);

  const streaming = cursor < source.length;

  // Stable across ticks, so the scroll view does not re-render as text grows.
  const scrollProps = useMemo(
    () => ({
      ref: scrollRef,
      onLayout: (event: LayoutChangeEvent) => {
        viewport.value = event.nativeEvent.layout.height;
      },
      onScrollBeginDrag: () => {
        following.value = false;
        setDetached(true);
      },
      onScrollEndDrag: rejoinAtBottom,
      onMomentumScrollEnd: rejoinAtBottom,
      onContentSizeChange: (_: number, height: number) => {
        target.value = Math.max(0, height - viewport.value);
      },
    }),
    [scrollRef, viewport, following, rejoinAtBottom, target]
  );

  return {
    run,
    streaming,
    writing: streaming && cursor > 0,
    markdown: streaming ? closeOpenEmphasis(source.slice(0, cursor)) : source,
    detached,
    follow,
    jump,
    replay,
    scrollProps,
  };
}
