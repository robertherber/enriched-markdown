import { memo, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import type { MarkdownImageBlock } from 'react-native-enriched-markdown';
import {
  GIANT_STEPS_CHANGES,
  NOTE_NAMES,
  type Quality,
} from '../audio/harmony';
import { usePlayer, usePlayerState } from '../player';
import { BRASS, CREAM, CREAM_SOFT, FONTS, SMOKE, SMOKE_EDGE } from '../theme';
import { SETTLE, useEntrance } from './motion';

const SIZE = 300;
const C = SIZE / 2;
const LABEL_R = 128;
const PATH_R = 98;

// Position on the circle of fifths, C at the top, clockwise.
function fifths(pc: number) {
  'worklet';
  return (pc * 7) % 12;
}

function at(k: number, r: number) {
  'worklet';
  const a = ((-90 + k * 30) * Math.PI) / 180;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
}

// The way round the circle that moves the marker the least.
function nearestTurn(from: number, to: number) {
  'worklet';
  const diff = ((((to - from) % 12) + 18) % 12) - 6;
  return from + diff;
}

// Steps round the circle glide; a jump to another key area, like E♭ to
// A minor, cuts straight there instead of sweeping past chords not played.
function moveMarker(marker: SharedValue<number>, pc: number) {
  'worklet';
  const target = nearestTurn(marker.value, fifths(pc));
  marker.value =
    Math.abs(target - marker.value) > 3
      ? target
      : withTiming(target, { duration: 150, easing: SETTLE });
}

const RING = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
const TONICS = [11, 7, 3];
const DOMINANT_OF: Record<number, number> = { 11: 6, 7: 2, 3: 10 };

const QUALITIES: Quality[] = ['maj', 'dom', 'min'];
const QUALITY_LABELS = ['MAJ 7', 'DOM 7', 'MIN 7'];

const VOICING: Record<Quality, number[]> = {
  maj: [0, 16, 19, 23, 26],
  dom: [0, 16, 21, 22, 26],
  min: [0, 15, 19, 22, 26],
};

function chordNotes(pc: number, quality: Quality) {
  const root = 40 + ((pc - 40 + 120) % 12);
  return VOICING[quality].map((offset) => root + offset);
}

// The Coltrane changes drawn on the circle of fifths: three tonics a major
// third apart form a triangle, each with its dominant one step clockwise.
// The marker follows Giant Steps while it plays; a tap plays a cadence.
export function ChangesWheel({ block }: { block: MarkdownImageBlock }) {
  const player = usePlayer();
  const following = usePlayerState((s) => s.track === 'giantSteps');
  const enter = useEntrance(800);
  const marker = useSharedValue(fifths(11));
  const pulse = useSharedValue(0);
  const lastChord = useSharedValue(-1);
  // The chord on show, read on the UI thread so the name keeps up at tempo.
  const shownPc = useSharedValue(-1);
  const shownQuality = useSharedValue(0);

  const moveTo = (pc: number, quality: Quality) => {
    moveMarker(marker, pc);
    pulse.value = withSequence(
      withTiming(1, { duration: 60 }),
      withTiming(0, { duration: 420 })
    );
    shownPc.value = pc;
    shownQuality.value = QUALITIES.indexOf(quality);
  };

  useAnimatedReaction(
    () => (following ? player.chord.value : -1),
    (index) => {
      if (index < 0 || index === lastChord.value) return;
      lastChord.value = index;
      const c = GIANT_STEPS_CHANGES[index]!;
      moveMarker(marker, c.root);
      pulse.value = withSequence(
        withTiming(1, { duration: 50 }),
        withTiming(0, { duration: 300 })
      );
      shownPc.value = c.root;
      shownQuality.value = QUALITIES.indexOf(c.quality);
    }
  );

  // Back to the three tonics once the record stops.
  useEffect(() => {
    if (following) return;
    lastChord.value = -1;
    shownPc.value = -1;
    moveMarker(marker, TONICS[0]!);
  }, [following, lastChord, shownPc, marker]);

  const cadence = (tonic: number) => {
    const dominant = DOMINANT_OF[tonic]!;
    player.strike('piano', chordNotes(dominant, 'dom'), 0.5);
    moveTo(dominant, 'dom');
    setTimeout(() => {
      player.strike('piano', chordNotes(tonic, 'maj'), 1.6);
      moveTo(tonic, 'maj');
    }, 420);
  };

  const cardStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: interpolate(enter.value, [0, 1], [0.96, 1]) }],
  }));
  const triangleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0.3, 1], [0, 1], 'clamp'),
    transform: [{ rotate: `${interpolate(enter.value, [0, 1], [-60, 0])}deg` }],
  }));

  return (
    <Animated.View style={[styles.card, cardStyle]}>
      <View style={styles.header}>
        <Text style={styles.kicker}>THE COLTRANE CHANGES</Text>
        <Text style={styles.kicker}>{block.title || block.altText}</Text>
      </View>
      <View style={styles.wheel}>
        <Ring />
        <Animated.View style={[StyleSheet.absoluteFill, triangleStyle]}>
          <Triangle />
        </Animated.View>
        <Marker marker={marker} pulse={pulse} />
        <CenterLabel pc={shownPc} quality={shownQuality} />
        {TONICS.map((pc) => {
          const p = at(fifths(pc), LABEL_R);
          return (
            <Pressable
              key={pc}
              onPress={() => cadence(pc)}
              accessibilityRole="button"
              accessibilityLabel={`Play the cadence into ${NOTE_NAMES[pc]}`}
              style={[
                styles.hit,
                {
                  left: `${((p.x - 26) / SIZE) * 100}%`,
                  top: `${((p.y - 26) / SIZE) * 100}%`,
                },
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.hint}>
        {following
          ? 'following the record…'
          : 'tap a key centre, or drop the needle above'}
      </Text>
    </Animated.View>
  );
}

// Every name is mounted once and shown by opacity, so a chord change never
// waits for a React render.
const CenterLabel = memo(function CenterLabel({
  pc,
  quality,
}: {
  pc: SharedValue<number>;
  quality: SharedValue<number>;
}) {
  return (
    <View style={styles.center} pointerEvents="none">
      <Shown when={pc} equals={-1}>
        <Text style={styles.idleName}>B · G · E♭</Text>
        <Text style={styles.chordQuality}>MAJOR THIRDS</Text>
      </Shown>
      {NOTE_NAMES.map((name, i) => (
        <Shown key={name} when={pc} equals={i} offset={-7}>
          <Text style={styles.chordName}>{name}</Text>
        </Shown>
      ))}
      {QUALITY_LABELS.map((label, i) => (
        <Shown key={label} when={quality} equals={i} unless={pc} offset={30}>
          <Text style={styles.chordQuality}>{label}</Text>
        </Shown>
      ))}
    </View>
  );
});

function Shown({
  when,
  equals,
  unless,
  offset = 0,
  children,
}: {
  when: SharedValue<number>;
  equals: number;
  unless?: SharedValue<number>;
  offset?: number;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: when.value === equals && (!unless || unless.value >= 0) ? 1 : 0,
  }));
  return (
    <Animated.View style={[styles.shown, { top: offset }, style]}>
      {children}
    </Animated.View>
  );
}

const Ring = memo(function Ring() {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Circle
        cx={C}
        cy={C}
        r={146}
        fill="none"
        stroke={CREAM}
        strokeOpacity={0.08}
      />
      <Circle
        cx={C}
        cy={C}
        r={PATH_R}
        fill="none"
        stroke={CREAM}
        strokeOpacity={0.1}
      />
      {RING.map((pc, k) => {
        const inner = at(k, 108);
        const outer = at(k, 114);
        return (
          <Path
            key={`t${pc}`}
            d={`M${inner.x} ${inner.y} L${outer.x} ${outer.y}`}
            stroke={CREAM}
            strokeOpacity={0.25}
          />
        );
      })}
      {TONICS.map((tonic) => {
        // Each dominant resolves one step anticlockwise into its tonic.
        const from = at(fifths(DOMINANT_OF[tonic]!), PATH_R);
        const to = at(fifths(tonic), PATH_R);
        return (
          <G key={`d${tonic}`}>
            <Path
              d={`M${from.x} ${from.y} A${PATH_R} ${PATH_R} 0 0 0 ${to.x} ${to.y}`}
              fill="none"
              stroke={CREAM}
              strokeOpacity={0.45}
              strokeWidth={2}
              strokeDasharray="2 4"
            />
            <Circle
              cx={from.x}
              cy={from.y}
              r={3.5}
              fill={CREAM}
              fillOpacity={0.6}
            />
          </G>
        );
      })}
      {RING.map((pc, k) => {
        const p = at(k, LABEL_R);
        const tonic = TONICS.includes(pc);
        const dominant = Object.values(DOMINANT_OF).includes(pc);
        return (
          <SvgText
            key={pc}
            x={p.x}
            y={p.y + (tonic ? 8 : 6)}
            textAnchor="middle"
            fontFamily={FONTS.display}
            fontSize={tonic ? 24 : 18}
            fill={tonic ? BRASS : CREAM}
            fillOpacity={tonic ? 1 : dominant ? 0.8 : 0.3}
          >
            {NOTE_NAMES[pc]}
          </SvgText>
        );
      })}
    </Svg>
  );
});

const Triangle = memo(function Triangle() {
  const points = TONICS.map((pc) => at(fifths(pc), PATH_R));
  const d = `M${points.map((p) => `${p.x} ${p.y}`).join(' L')} Z`;
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Path
        d={d}
        fill={BRASS}
        fillOpacity={0.08}
        stroke={BRASS}
        strokeWidth={1.6}
      />
      {points.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={4.5} fill={BRASS} />
      ))}
    </Svg>
  );
});

// The marker is two plain views moved by transforms, so following the band
// never redraws the wheel's SVG.
function Marker({
  marker,
  pulse,
}: {
  marker: SharedValue<number>;
  pulse: SharedValue<number>;
}) {
  const [width, setWidth] = useState(0);
  const unit = width / SIZE;
  const haloStyle = useAnimatedStyle(() => {
    const p = at(marker.value, PATH_R);
    return {
      transform: [
        { translateX: (p.x - 14) * unit },
        { translateY: (p.y - 14) * unit },
        { scale: 1 + pulse.value * 0.57 },
      ],
    };
  });
  const coreStyle = useAnimatedStyle(() => {
    const p = at(marker.value, PATH_R);
    return {
      transform: [
        { translateX: (p.x - 7) * unit },
        { translateY: (p.y - 7) * unit },
      ],
    };
  });
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <Backdrop />
      {width > 0 && (
        <>
          <Animated.View
            style={[
              styles.halo,
              { width: 28 * unit, height: 28 * unit, borderRadius: 14 * unit },
              haloStyle,
            ]}
          />
          <Animated.View
            style={[
              styles.core,
              { width: 14 * unit, height: 14 * unit, borderRadius: 7 * unit },
              coreStyle,
            ]}
          />
        </>
      )}
    </View>
  );
}

const Backdrop = memo(function Backdrop() {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Circle
        cx={C}
        cy={C}
        r={62}
        fill={SMOKE}
        stroke={CREAM}
        strokeOpacity={0.12}
      />
    </Svg>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: SMOKE,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SMOKE_EDGE,
    padding: 16,
    marginVertical: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kicker: {
    fontFamily: FONTS.monoMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    color: CREAM_SOFT,
  },
  wheel: {
    aspectRatio: 1,
    marginTop: 8,
  },
  halo: {
    position: 'absolute',
    backgroundColor: BRASS,
    opacity: 0.25,
  },
  core: {
    position: 'absolute',
    backgroundColor: CREAM,
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shown: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chordName: {
    fontFamily: FONTS.display,
    fontSize: 64,
    lineHeight: 64,
    color: CREAM,
  },
  idleName: {
    fontFamily: FONTS.display,
    fontSize: 36,
    lineHeight: 40,
    color: BRASS,
  },
  chordQuality: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: CREAM_SOFT,
  },
  hit: {
    position: 'absolute',
    width: `${(52 / SIZE) * 100}%`,
    height: `${(52 / SIZE) * 100}%`,
    borderRadius: 999,
  },
  hint: {
    fontFamily: FONTS.hand,
    fontSize: 21,
    color: BRASS,
    textAlign: 'center',
    marginTop: 6,
  },
});
