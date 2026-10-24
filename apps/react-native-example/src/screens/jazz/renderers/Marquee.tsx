import { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  Ellipse,
  Path,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import type { MarkdownLinkBlock } from 'react-native-enriched-markdown';
import { usePlayer } from '../player';
import { CREAM, CREAM_SOFT, FONTS, NEON, RED } from '../theme';
import { useEntrance } from './motion';

const TUBE_OFF = '#4A201B';
const GLOW = '#FF2A1C';

// A tube striking: a few stutters, then it holds.
function strike(delay: number) {
  return withDelay(
    delay,
    withSequence(
      withTiming(0.8, { duration: 40 }),
      withTiming(0.05, { duration: 70 }),
      withTiming(0.6, { duration: 50 }),
      withTiming(0.15, { duration: 110 }),
      withTiming(1, { duration: 90 })
    )
  );
}

// The club's sign over the stairs: neon that buzzes on when it arrives and a
// letterboard spelling out the week. A tap switches the lights.
export function Marquee({ block }: { block: MarkdownLinkBlock }) {
  const player = usePlayer();
  const [dates = '', band = '', guest = ''] = block.title.split(' · ');
  const enter = useEntrance(700);
  const script = useSharedValue(0);
  const name = useSharedValue(0);
  const failing = useSharedValue(1);
  const [lit, setLit] = useState(true);

  useEffect(() => {
    if (!lit) {
      script.value = withTiming(0, { duration: 120 });
      name.value = withTiming(0, { duration: 160 });
      cancelAnimation(failing);
      return;
    }
    script.value = strike(700);
    name.value = strike(1000);
    // One tube of the name is on its way out.
    failing.value = withDelay(
      2200,
      withRepeat(
        withSequence(
          withDelay(3200, withTiming(0.25, { duration: 40 })),
          withTiming(1, { duration: 60 }),
          withTiming(0.4, { duration: 50 }),
          withTiming(1, { duration: 120 })
        ),
        -1
      )
    );
    return () => cancelAnimation(failing);
  }, [lit, script, name, failing]);

  const switchLights = () => {
    if (!lit) player.strike('buzz', [0], 0.45);
    setLit((value) => !value);
  };

  const cardStyle = useAnimatedStyle(() => ({ opacity: enter.value }));
  const scriptStyle = useAnimatedStyle(() => ({ opacity: script.value }));
  const nameStyle = useAnimatedStyle(() => ({
    opacity: name.value * failing.value,
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: Math.max(script.value, name.value * failing.value) * 0.9,
  }));

  return (
    <Pressable
      onPress={switchLights}
      accessibilityRole="button"
      accessibilityLabel={lit ? 'Switch the sign off' : 'Switch the sign on'}
    >
      <Animated.View style={[styles.card, cardStyle]}>
        <Bricks />
        <Animated.View style={[StyleSheet.absoluteFill, haloStyle]}>
          <Halo />
        </Animated.View>
        <View style={styles.sign}>
          <View>
            <Text style={[styles.script, styles.tube]}>Village</Text>
            <Animated.Text style={[styles.script, styles.neon, scriptStyle]}>
              Village
            </Animated.Text>
          </View>
          <View>
            <Text style={[styles.name, styles.tube]}>VANGUARD</Text>
            <Animated.Text style={[styles.name, styles.neon, nameStyle]}>
              VANGUARD
            </Animated.Text>
          </View>
        </View>
        <Awning />
        <View style={styles.board}>
          <BoardLine text="TONIGHT" size={13} color={RED} />
          <BoardLine text={band.toUpperCase()} size={22} />
          <BoardLine text={guest.toUpperCase()} size={16} />
          <BoardLine text={dates.toUpperCase()} size={16} color={CREAM_SOFT} />
        </View>
        <View style={styles.footer}>
          <Text style={styles.address}>
            178 SEVENTH AVE. SOUTH · SINCE 1935
          </Text>
          <Animated.Text style={[styles.neon, styles.down, scriptStyle]}>
            downstairs ↓
          </Animated.Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

// Plastic letters pushed into the felt, none of them quite straight.
const BoardLine = memo(function BoardLine({
  text,
  size,
  color = CREAM,
}: {
  text: string;
  size: number;
  color?: string;
}) {
  return (
    <View style={styles.boardLine}>
      {Array.from(text).map((char, i) => {
        const wobble = Math.sin(i * 12.9898 + text.length) * 1.6;
        return (
          <Text
            key={i}
            style={[
              styles.letter,
              {
                fontSize: size,
                color,
                transform: [
                  { rotate: `${wobble}deg` },
                  { translateY: wobble * 0.4 },
                ],
              },
            ]}
          >
            {char}
          </Text>
        );
      })}
    </View>
  );
});

const Bricks = memo(function Bricks() {
  return (
    <Svg style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern
          id="bricks"
          width={30}
          height={16}
          patternUnits="userSpaceOnUse"
        >
          <Rect width={30} height={16} fill="#3A1C15" />
          <Path
            d="M0 0.5 H30 M0 8.5 H30 M0.5 0 V8 M15.5 8 V16"
            stroke="#1C0E0A"
            strokeWidth={1.4}
          />
        </Pattern>
        <RadialGradient id="vignette" cx="50%" cy="38%" r="75%">
          <Stop offset="0.3" stopColor="#000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000" stopOpacity={0.85} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#bricks)" />
      <Rect width="100%" height="100%" fill="url(#vignette)" />
    </Svg>
  );
});

const Halo = memo(function Halo() {
  return (
    <Svg style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={GLOW} stopOpacity={0.42} />
          <Stop offset="1" stopColor={GLOW} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx="50%" cy="21%" rx="62%" ry="24%" fill="url(#halo)" />
    </Svg>
  );
});

const Awning = memo(function Awning() {
  const scallops = Array.from({ length: 12 }, (_, i) => {
    const x = 4 + i * 7.67;
    return `Q${x + 3.83} 46 ${x + 7.67} 34`;
  }).join(' ');
  return (
    <View style={styles.awning}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 48"
        preserveAspectRatio="none"
      >
        <Path d={`M12 0 H88 L96 34 ${scallops} L4 34 Z`} fill={RED} />
        <Path d="M12 0 H88 L90 8 H10 Z" fill="#000" fillOpacity={0.22} />
        {[24, 36, 50, 64, 76].map((x) => (
          <Path
            key={x}
            d={`M${x} 0 L${x + (x - 50) * 0.16} 34`}
            stroke="#000"
            strokeOpacity={0.12}
            strokeWidth={0.6}
          />
        ))}
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    paddingTop: 26,
    paddingBottom: 18,
    paddingHorizontal: 16,
    marginVertical: 4,
    backgroundColor: '#1A0D0A',
  },
  sign: {
    alignItems: 'center',
  },
  tube: {
    color: TUBE_OFF,
  },
  neon: {
    position: 'absolute',
    top: 0,
    left: 0,
    color: NEON,
    textShadowColor: GLOW,
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
  script: {
    fontFamily: FONTS.handBold,
    fontSize: 46,
    lineHeight: 50,
    alignSelf: 'center',
    transform: [{ rotate: '-5deg' }],
  },
  name: {
    fontFamily: FONTS.neon,
    fontSize: 36,
    lineHeight: 48,
    letterSpacing: 1,
  },
  awning: {
    height: 52,
    marginTop: 14,
    marginHorizontal: -6,
  },
  board: {
    backgroundColor: '#0E0D0C',
    borderRadius: 6,
    borderWidth: 3,
    borderColor: '#2E2A25',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 18,
    marginTop: -4,
    gap: 4,
  },
  boardLine: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    borderBottomWidth: 1,
    borderBottomColor: '#1F1C19',
    paddingBottom: 2,
  },
  letter: {
    fontFamily: FONTS.display,
    letterSpacing: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  address: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    letterSpacing: 1,
    color: CREAM_SOFT,
  },
  down: {
    position: 'relative',
    fontFamily: FONTS.handBold,
    fontSize: 22,
  },
});
