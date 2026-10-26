import { memo, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import type { MarkdownLinkBlock } from 'react-native-enriched-markdown';
import { useAnchor } from '../anchors';
import { usePlayer, usePlayerState } from '../player';
import { BRASS, FONTS, NIGHT, ORANGE, RED } from '../theme';
import { CUE_DELAY_MS, useEntrance } from './motion';
import { SourceNote } from './SourceNote';
import { useArtwork } from './useArtwork';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const HUB = 15;
const FULL = 45;
// Tape speed in reel units a second; the reels turn slower as they fill.
const TAPE_SPEED = 70;
// Seconds to wind the whole reel across: short, so the packs visibly creep.
const REEL_SECONDS = 150;
const WIND_STEPS = 400;

const PARTS = ['Acknowledgement', 'Resolution', 'Pursuance', 'Psalm'];

function packRadii(wound: number) {
  'worklet';
  const area = FULL * FULL - HUB * HUB;
  return {
    supply: Math.sqrt(FULL * FULL - wound * area),
    takeUp: Math.sqrt(HUB * HUB + wound * area),
  };
}

// A studio deck: the tape crosses from one reel to the other, the VU needles
// swing with the music and a mechanical counter ticks over.
export function TapeMachine(_props: { block: MarkdownLinkBlock }) {
  const player = usePlayer();
  const playing = usePlayerState((s) => s.track === 'loveSupreme');
  const cueing = usePlayerState((s) => s.loading === 'loveSupreme');
  const enter = useEntrance(800);
  const anchor = useAnchor('loveSupreme');
  const on = useSharedValue(0);
  const wound = useSharedValue(0.14);
  const packWound = useSharedValue(0.14);
  const supplyAngle = useSharedValue(0);
  const takeUpAngle = useSharedValue(0);
  const speed = useSharedValue(0);
  const left = useSharedValue(0);
  const right = useSharedValue(0);

  useEffect(() => {
    on.value = playing ? 1 : 0;
  }, [on, playing]);

  const { cue } = player;
  useEffect(() => {
    const timer = setTimeout(cue, CUE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [cue]);

  // Settles a value towards its target, and stops writing once it is there so
  // an idle deck costs nothing per frame.
  const ease = (value: SharedValue<number>, target: number, k: number) => {
    'worklet';
    const next = value.value + (target - value.value) * k;
    if (Math.abs(next - target) < 0.001) {
      if (value.value !== target) value.value = target;
    } else {
      value.value = next;
    }
  };

  useFrameCallback(({ timeSincePreviousFrame }) => {
    const dt = (timeSincePreviousFrame ?? 16) / 1000;
    ease(speed, on.value, 1 - Math.exp(-dt / 0.3));
    // VU ballistics: about 300 ms to settle, the right channel a touch lazier.
    const level = player.level.value * on.value;
    ease(left, level, 1 - Math.exp(-dt / 0.1));
    ease(right, level * 0.92, 1 - Math.exp(-dt / 0.14));
    if (speed.value < 0.001) return;
    const v = TAPE_SPEED * speed.value;
    const { supply, takeUp } = packRadii(wound.value);
    supplyAngle.value += ((v / supply) * 180 * dt) / Math.PI;
    takeUpAngle.value += ((v / takeUp) * 180 * dt) / Math.PI;
    wound.value = Math.min(
      0.96,
      wound.value + (dt * speed.value) / REEL_SECONDS
    );
    // The packs and the tape path are SVG, redrawn whole on every change, so
    // they follow the wind in visible steps rather than every frame.
    const step = Math.round(wound.value * WIND_STEPS) / WIND_STEPS;
    if (step !== packWound.value) packWound.value = step;
  });

  const cardStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: interpolate(enter.value, [0, 1], [24, 0]) }],
  }));

  return (
    <Animated.View ref={anchor} style={[styles.card, cardStyle]}>
      <View style={styles.labels}>
        <TapeBox />
        <View style={styles.tape}>
          <Text style={styles.tapeTitle}>A Love Supreme</Text>
          <Text style={styles.tapeNote}>
            RVG · ENGLEWOOD CLIFFS · DEC 9, 1964
          </Text>
        </View>
      </View>
      <View style={styles.deck}>
        <TapePath wound={packWound} />
        <View style={styles.reels}>
          <Reel angle={supplyAngle} wound={packWound} side="supply" />
          <Reel angle={takeUpAngle} wound={packWound} side="takeUp" />
        </View>
        <View style={styles.headBlock}>
          <Text style={styles.headText}>RVG</Text>
        </View>
      </View>
      <View style={styles.meters}>
        <Meter needle={left} channel="L" glow={on} />
        <Meter needle={right} channel="R" glow={on} />
      </View>
      <View style={styles.controls}>
        <Counter wound={wound} />
        <View style={styles.keys}>
          <Key
            label="◀◀"
            onPress={() => {
              if (!playing) return;
              player.stop();
              player.toggle('loveSupreme');
            }}
          />
          <Key
            label={cueing ? '…' : '▶'}
            down={playing || cueing}
            onPress={() => {
              if (!playing && !cueing) player.toggle('loveSupreme');
            }}
          />
          <Key
            label="■"
            onPress={() => {
              if (playing || cueing) player.stop();
            }}
          />
          <View style={[styles.recLamp, playing && styles.recLampOn]} />
        </View>
      </View>
      <View style={styles.parts}>
        {PARTS.map((part, i) => (
          <View key={part} style={styles.part}>
            <View style={[styles.lamp, playing && i === 0 && styles.lampOn]} />
            <Text style={styles.partNumber}>{['I', 'II', 'III', 'IV'][i]}</Text>
            <Text style={styles.partName}>{part}</Text>
          </View>
        ))}
      </View>
      <SourceNote
        track="loveSupreme"
        prefix="McCOY TYNER · JIMMY GARRISON · ELVIN JONES"
      />
    </Animated.View>
  );
}

// The record's cover, propped against the deck while the real record plays.
function TapeBox() {
  const uri = useArtwork('loveSupreme');
  if (!uri) return null;
  return (
    <View style={styles.box}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const Reel = memo(function Reel({
  angle,
  wound,
  side,
}: {
  angle: SharedValue<number>;
  wound: SharedValue<number>;
  side: 'supply' | 'takeUp';
}) {
  const packProps = useAnimatedProps(() => ({
    r: packRadii(wound.value)[side],
  }));
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
  }));
  return (
    <View style={styles.reel}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100">
        <AnimatedCircle
          cx={50}
          cy={50}
          animatedProps={packProps}
          fill="#3B2A1F"
        />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, spinStyle]}>
        <Flange />
      </Animated.View>
    </View>
  );
});

// An aluminium flange with three windows onto the tape pack.
const Flange = memo(function Flange() {
  const windows = [0, 120, 240]
    .map((start) => {
      const p = (r: number, deg: number) => {
        const a = ((deg - 90) * Math.PI) / 180;
        return `${50 + r * Math.cos(a)} ${50 + r * Math.sin(a)}`;
      };
      const a = start + 14;
      const b = start + 106;
      return `M${p(19, a)} L${p(43, a)} A43 43 0 0 1 ${p(43, b)} L${p(19, b)} A19 19 0 0 0 ${p(19, a)} Z`;
    })
    .join(' ');
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#D9D3C6" />
          <Stop offset="0.5" stopColor="#9F998E" />
          <Stop offset="1" stopColor="#CFC9BC" />
        </LinearGradient>
      </Defs>
      <Path
        d={`M50 1 A49 49 0 1 1 49.99 1 Z ${windows}`}
        fill="url(#metal)"
        fillRule="evenodd"
        stroke="#7D776D"
        strokeWidth={0.8}
      />
      <Circle cx={50} cy={50} r={11} fill="#6F6A62" />
      <Circle cx={50} cy={50} r={4} fill="#1A1815" />
      {[0, 120, 240].map((deg) => {
        const a = ((deg - 90) * Math.PI) / 180;
        return (
          <Rect
            key={deg}
            x={50 + 7 * Math.cos(a) - 1.5}
            y={50 + 7 * Math.sin(a) - 1.5}
            width={3}
            height={3}
            fill="#1A1815"
          />
        );
      })}
    </Svg>
  );
});

// The tape leaves the supply pack, runs over the guides and the head, and
// winds onto the take-up pack, following both radii as they change.
function TapePath({ wound }: { wound: SharedValue<number> }) {
  const props = useAnimatedProps(() => {
    const { supply, takeUp } = packRadii(wound.value);
    // Reel centres sit at 25 and 75 across a 200 x 100 deck.
    return {
      d: `M${25 * 2 - supply} 50 L44 92 L84 98 H116 L156 92 L${75 * 2 + takeUp} 50`,
    };
  });
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox="0 0 200 110"
      preserveAspectRatio="none"
    >
      <AnimatedPath
        animatedProps={props}
        stroke="#3B2A1F"
        strokeWidth={1.6}
        fill="none"
      />
      <Circle cx={44} cy={92} r={4} fill="#BEB8AB" />
      <Circle cx={156} cy={92} r={4} fill="#BEB8AB" />
    </Svg>
  );
}

// The face is static SVG; the needle is a plain view turned on the UI thread,
// so the swing never redraws the scale.
function Meter({
  needle,
  channel,
  glow,
}: {
  needle: SharedValue<number>;
  channel: string;
  glow: SharedValue<number>;
}) {
  const [width, setWidth] = useState(0);
  const unit = width / 180;
  const length = 88 * unit;
  const needleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-48 + Math.min(1.08, needle.value) * 96}deg` }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value * 0.35 }));
  return (
    <View
      style={styles.meter}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <Animated.View style={[styles.meterGlow, glowStyle]} />
      <MeterFace channel={channel} />
      {width > 0 && (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.needleArm,
              {
                left: 90 * unit - 1,
                top: 112 * unit - length,
                height: length * 2,
              },
              needleStyle,
            ]}
          >
            <View style={[styles.needle, { height: length }]} />
          </Animated.View>
          <View
            pointerEvents="none"
            style={[
              styles.needleHub,
              {
                left: 90 * unit - 6 * unit,
                top: 104 * unit - 6 * unit,
                width: 12 * unit,
                height: 12 * unit,
                borderRadius: 6 * unit,
              },
            ]}
          />
        </>
      )}
    </View>
  );
}

const MeterFace = memo(function MeterFace({ channel }: { channel: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 180 100">
      <Scale />
      <SvgText
        x={90}
        y={74}
        textAnchor="middle"
        fontFamily={FONTS.display}
        fontSize={18}
        fill={NIGHT}
      >
        VU
      </SvgText>
      <SvgText
        x={14}
        y={92}
        fontFamily={FONTS.mono}
        fontSize={9}
        fill={NIGHT}
        fillOpacity={0.6}
      >
        {channel}
      </SvgText>
    </Svg>
  );
});

const TICKS = [
  { at: 0, label: '20' },
  { at: 0.22, label: '10' },
  { at: 0.4, label: '5' },
  { at: 0.58, label: '' },
  { at: 0.72, label: '0' },
  { at: 0.86, label: '' },
  { at: 1, label: '+3' },
];

const Scale = memo(function Scale() {
  const point = (t: number, r: number) => {
    const a = ((-48 + t * 96) * Math.PI) / 180;
    return { x: 90 + r * Math.sin(a), y: 112 - r * Math.cos(a) };
  };
  const arc = (from: number, to: number, r: number) => {
    const a = point(from, r);
    const b = point(to, r);
    return `M${a.x} ${a.y} A${r} ${r} 0 0 1 ${b.x} ${b.y}`;
  };
  return (
    <>
      <Path d={arc(0, 0.72, 74)} stroke={NIGHT} strokeWidth={1.2} fill="none" />
      <Path d={arc(0.72, 1, 74)} stroke={RED} strokeWidth={4} fill="none" />
      {TICKS.map((tick) => {
        const inner = point(tick.at, 70);
        const outer = point(tick.at, 80);
        return (
          <Path
            key={tick.at}
            d={`M${inner.x} ${inner.y} L${outer.x} ${outer.y}`}
            stroke={tick.at > 0.72 ? RED : NIGHT}
            strokeWidth={1.2}
          />
        );
      })}
      {TICKS.filter((tick) => tick.label).map((tick) => {
        const label = point(tick.at, 89);
        return (
          <SvgText
            key={tick.label}
            x={label.x}
            y={label.y + 3}
            textAnchor="middle"
            fontFamily={FONTS.mono}
            fontSize={8.5}
            fill={tick.at > 0.72 ? RED : NIGHT}
          >
            {tick.label}
          </SvgText>
        );
      })}
    </>
  );
});

const COUNTS_PER_REEL = 1800;
const DIGIT_HEIGHT = 26;
const WHEEL_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
const PLACES = [1000, 100, 10, 1];

// A mechanical counter: four digit wheels turned on the UI thread, each one
// rolling over only while the wheel to its right passes from 9 to 0.
const Counter = memo(function Counter({
  wound,
}: {
  wound: SharedValue<number>;
}) {
  return (
    <View
      style={styles.counter}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {PLACES.map((place) => (
        <DigitWheel key={place} wound={wound} place={place} />
      ))}
    </View>
  );
});

function DigitWheel({
  wound,
  place,
}: {
  wound: SharedValue<number>;
  place: number;
}) {
  const style = useAnimatedStyle(() => {
    const count = wound.value * COUNTS_PER_REEL;
    const turns = Math.floor(count / place) % 10;
    const carry = Math.max(0, (count % place) - (place - 1));
    return {
      transform: [{ translateY: -(turns + carry) * DIGIT_HEIGHT }],
    };
  });
  return (
    <View style={styles.digit}>
      <Animated.View style={style}>
        {WHEEL_DIGITS.map((digit, i) => (
          <Text key={i} style={styles.digitText}>
            {digit}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

function Key({
  label,
  down = false,
  onPress,
}: {
  label: string;
  down?: boolean;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const sunk = down || pressed;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.key, sunk && styles.keyDown]}
    >
      <Text style={[styles.keyText, down && styles.keyTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#25211D',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3A352F',
    padding: 14,
    marginVertical: 4,
  },
  labels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 10,
  },
  box: {
    width: 54,
    height: 54,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: '#111',
    transform: [{ rotate: '-4deg' }],
  },
  tape: {
    backgroundColor: '#E6DCB6',
    paddingHorizontal: 18,
    paddingVertical: 4,
    transform: [{ rotate: '-1.5deg' }],
    alignItems: 'center',
  },
  tapeTitle: {
    fontFamily: FONTS.handBold,
    fontSize: 26,
    lineHeight: 28,
    color: '#2A211B',
  },
  tapeNote: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    letterSpacing: 0.8,
    color: '#5C5040',
  },
  deck: {
    aspectRatio: 2 / 1.1,
  },
  reels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reel: {
    width: '50%',
    aspectRatio: 1,
  },
  headBlock: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    width: '20%',
    height: 18,
    borderRadius: 3,
    backgroundColor: '#8F897E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: {
    fontFamily: FONTS.monoMedium,
    fontSize: 9,
    letterSpacing: 2,
    color: '#2A2621',
  },
  meters: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  meter: {
    flex: 1,
    aspectRatio: 1.8,
    backgroundColor: '#EFE2BE',
    borderRadius: 6,
    borderWidth: 3,
    borderColor: '#14120F',
    overflow: 'hidden',
  },
  meterGlow: {
    ...StyleSheet.absoluteFill,
    backgroundColor: ORANGE,
  },
  // Twice the needle's length and centred on the pivot, so a plain rotate
  // turns it around the pivot.
  needleArm: {
    position: 'absolute',
    width: 2,
  },
  needle: {
    width: 1.6,
    marginLeft: 0.2,
    backgroundColor: '#16130F',
  },
  needleHub: {
    position: 'absolute',
    backgroundColor: '#2A2621',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  counter: {
    flexDirection: 'row',
    gap: 2,
    padding: 3,
    borderRadius: 4,
    backgroundColor: '#0E0C0A',
  },
  digit: {
    width: 18,
    height: DIGIT_HEIGHT,
    borderRadius: 2,
    backgroundColor: '#1C1A17',
    overflow: 'hidden',
  },
  digitText: {
    height: DIGIT_HEIGHT,
    lineHeight: DIGIT_HEIGHT,
    textAlign: 'center',
    fontFamily: FONTS.monoMedium,
    fontSize: 15,
    color: '#ECE4D0',
  },
  keys: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  key: {
    width: 46,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#E9E3D5',
    borderBottomWidth: 4,
    borderBottomColor: '#A39C8E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyDown: {
    borderBottomWidth: 1,
    marginTop: 3,
    backgroundColor: '#D3CCBC',
  },
  keyText: {
    fontSize: 14,
    color: '#2A2621',
  },
  keyTextOn: {
    color: RED,
  },
  recLamp: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4A1E1A',
    marginLeft: 2,
  },
  recLampOn: {
    backgroundColor: '#FF4A3A',
    shadowColor: '#FF4A3A',
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  parts: {
    marginTop: 14,
    gap: 6,
  },
  part: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lamp: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#3E372F',
  },
  lampOn: {
    backgroundColor: BRASS,
    shadowColor: BRASS,
    shadowOpacity: 0.9,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  partNumber: {
    width: 26,
    fontFamily: FONTS.display,
    fontSize: 18,
    color: BRASS,
  },
  partName: {
    fontFamily: FONTS.bodyItalic,
    fontSize: 17,
    color: '#E6DCC6',
  },
});
