import { memo, useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
  TextPath,
} from 'react-native-svg';
import { LabelMark } from '../LabelMark';
import { Spotlight } from '../LinerNotesScreen';
import {
  BRASS,
  CREAM,
  CREAM_SOFT,
  FONTS,
  NEON,
  NIGHT,
  ORANGE,
  SMOKE_EDGE,
} from '../theme';

const DISC = 300;
// Brass deep enough to read as ink on the cream sticker.
const STICKER_INK = '#8C6418';
const SPINE = 16;
// How far the record slides out of the sleeve when it beckons.
const PULL = 30;

// The folded Duo is the sleeve's front: shrink-wrapped, a little worn, the
// record peeking out of the open edge. Open it, like the record, to read.
export function Cover({ onRead }: { onRead: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const spin = useSharedValue(0);
  const pull = useSharedValue(0);
  const glare = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(
      withTiming(360, { duration: 9000, easing: Easing.linear }),
      -1
    );
    pull.value = withRepeat(
      withSequence(
        withDelay(
          1800,
          withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })
        ),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
    glare.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.quad) }),
        withDelay(4600, withTiming(0, { duration: 0 }))
      ),
      -1
    );
  }, [spin, pull, glare]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -pull.value * PULL }],
  }));
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));
  const hintStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + pull.value * 0.4,
    transform: [{ translateX: -pull.value * 8 }, { rotate: '-4deg' }],
  }));
  const glareStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(glare.value, [0, 1], [-260, width + 120]) },
      { rotate: '18deg' },
    ],
  }));

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 },
      ]}
    >
      <Spotlight />
      <Sleeve width={width} height={height} />
      <Animated.View
        style={[styles.disc, { top: height * 0.38 }, slideStyle]}
        pointerEvents="none"
      >
        <Animated.View style={[StyleSheet.absoluteFill, spinStyle]}>
          <Vinyl />
          <View style={styles.labelMark}>
            <LabelMark color={NIGHT} scale={0.42} />
          </View>
        </Animated.View>
        <Sheen />
      </Animated.View>
      <Spine height={height} />
      <Sticker top={height * 0.5} />

      <Text style={styles.kicker}>A LIFE IN RECORDS · 1957–1964</Text>
      <Text style={styles.name}>JOHN</Text>
      <Text style={[styles.name, styles.surname]}>COLTRANE</Text>
      <View style={styles.titleRow}>
        <Text style={styles.neon}>Liner Notes</Text>
        <View style={styles.stereo}>
          <Text style={styles.stereoText}>STEREO</Text>
        </View>
      </View>
      <View style={styles.spacer} />
      <Animated.Text style={[styles.hint, hintStyle]}>
        ← open the sleeve to read
      </Animated.Text>
      <View style={styles.footer}>
        <LabelMark />
        <Pressable
          onPress={onRead}
          hitSlop={12}
          accessibilityRole="button"
          testID="liner-notes-read-folded"
        >
          <Text style={styles.folded}>read it folded →</Text>
        </Pressable>
      </View>

      <Animated.View
        style={[styles.glare, { height: height * 1.6 }, glareStyle]}
        pointerEvents="none"
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="glare" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.09} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#glare)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

// The same speckle on every render, from a fixed seed.
function grain(count: number) {
  let seed = 1967;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: count }, () => ({
    x: next(),
    y: next(),
    size: 0.6 + next() * 0.9,
    opacity: 0.025 + next() * 0.045,
  }));
}

const GRAIN = grain(520);

// Board grain and the ring the record has worn into the sleeve.
const Sleeve = memo(function Sleeve({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const ring = width * 0.41;
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      {GRAIN.map((speck, i) => (
        <Rect
          key={i}
          x={speck.x * width}
          y={speck.y * height}
          width={speck.size}
          height={speck.size}
          fill={CREAM}
          fillOpacity={speck.opacity}
        />
      ))}
      <Circle
        cx={width * 0.54}
        cy={height * 0.58}
        r={ring}
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity={0.045}
        strokeWidth={12}
      />
      <Circle
        cx={width * 0.54}
        cy={height * 0.58}
        r={ring * 0.36}
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity={0.03}
        strokeWidth={5}
      />
    </Svg>
  );
});

// The spine along the hinge, lettered bottom to top like a shelf of records.
function Spine({ height }: { height: number }) {
  return (
    <View style={styles.spine} pointerEvents="none">
      <Svg width={SPINE} height={height}>
        <SvgText
          x={-height / 2}
          y={11}
          transform="rotate(-90)"
          textAnchor="middle"
          fontFamily={FONTS.mono}
          fontSize={8}
          letterSpacing={3}
          fill={CREAM_SOFT}
          fillOpacity={0.7}
        >
          JOHN COLTRANE · LINER NOTES · JC 1926–1967 · RVG
        </SvgText>
      </Svg>
    </View>
  );
}

const GROOVES = Array.from({ length: 26 }, (_, i) => 40 + i * 2.2);

const Vinyl = memo(function Vinyl() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 200 200">
      <Defs>
        <Path id="cover-label" d="M100 74 a26 26 0 1 1 -0.01 0" />
      </Defs>
      <Circle cx={100} cy={100} r={100} fill="#0B0A09" />
      {GROOVES.map((r, i) => (
        <Circle
          key={r}
          cx={100}
          cy={100}
          r={r}
          fill="none"
          stroke={i % 5 === 0 ? '#2A2622' : '#1A1815'}
          strokeWidth={0.8}
        />
      ))}
      <Circle
        cx={100}
        cy={100}
        r={98.6}
        fill="none"
        stroke="#2E2A26"
        strokeWidth={1.6}
      />
      <Circle cx={100} cy={100} r={36} fill={ORANGE} />
      <Circle
        cx={100}
        cy={100}
        r={33}
        fill="none"
        stroke={CREAM}
        strokeOpacity={0.35}
        strokeWidth={0.6}
      />
      <SvgText
        fill={CREAM}
        fontFamily={FONTS.monoMedium}
        fontSize={5}
        letterSpacing={1.3}
      >
        <TextPath href="#cover-label">
          JOHN COLTRANE · SIDE A · 33⅓ RPM ·
        </TextPath>
      </SvgText>
      <SvgText
        x={100}
        y={115}
        textAnchor="middle"
        fontFamily={FONTS.mono}
        fontSize={4.2}
        letterSpacing={1}
        fill={NIGHT}
        fillOpacity={0.75}
      >
        RVG
      </SvgText>
      <Circle cx={100} cy={100} r={2.4} fill={NIGHT} />
    </Svg>
  );
});

// Light caught in the grooves; it stays put while the record turns under it.
const Sheen = memo(function Sheen() {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id="cover-sheen" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0.3" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="0.42" stopColor="#FFFFFF" stopOpacity={0.09} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="0.62" stopColor="#FFFFFF" stopOpacity={0.06} />
          <Stop offset="0.72" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Circle cx={100} cy={100} r={99} fill="url(#cover-sheen)" />
    </Svg>
  );
});

// The shop's sticker on the shrink-wrap.
function Sticker({ top }: { top: number }) {
  return (
    <View style={[styles.sticker, { top }]} pointerEvents="none">
      <View style={styles.stickerRing} />
      <Text style={styles.stickerBig}>3 RECORDS</Text>
      <Text style={styles.stickerMid}>INSIDE</Text>
      <Text style={styles.stickerSmall}>REAL PREVIEWS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NIGHT,
    paddingLeft: SPINE + 24,
    paddingRight: 28,
    overflow: 'hidden',
  },
  disc: {
    position: 'absolute',
    width: DISC,
    height: DISC,
    right: -DISC * 0.42,
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowRadius: 18,
    shadowOffset: { width: -6, height: 4 },
  },
  spine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SPINE,
    backgroundColor: '#0B0A08',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: SMOKE_EDGE,
  },
  kicker: {
    fontFamily: FONTS.monoMedium,
    fontSize: 11,
    letterSpacing: 2,
    color: BRASS,
    marginBottom: 6,
  },
  name: {
    fontFamily: FONTS.display,
    fontSize: 112,
    lineHeight: 98,
    color: CREAM,
    paddingTop: 12,
  },
  surname: {
    color: BRASS,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 8,
  },
  neon: {
    fontFamily: FONTS.neon,
    fontSize: 34,
    lineHeight: 46,
    color: NEON,
    textShadowColor: NEON,
    textShadowRadius: 12,
  },
  stereo: {
    borderWidth: 1.5,
    borderColor: CREAM_SOFT,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingTop: 3,
    paddingBottom: 1,
  },
  stereoText: {
    fontFamily: FONTS.display,
    fontSize: 15,
    letterSpacing: 2,
    color: CREAM_SOFT,
  },
  sticker: {
    position: 'absolute',
    left: SPINE + 30,
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: CREAM,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-12deg' }],
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  stickerRing: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderRadius: 49,
    borderWidth: 1,
    borderColor: STICKER_INK,
    borderStyle: 'dashed',
  },
  stickerBig: {
    fontFamily: FONTS.display,
    fontSize: 22,
    lineHeight: 23,
    color: STICKER_INK,
    paddingTop: 4,
  },
  stickerMid: {
    fontFamily: FONTS.display,
    fontSize: 17,
    lineHeight: 17,
    letterSpacing: 3,
    color: NIGHT,
  },
  stickerSmall: {
    fontFamily: FONTS.monoMedium,
    fontSize: 7,
    letterSpacing: 1,
    color: STICKER_INK,
    marginTop: 4,
  },
  spacer: {
    flex: 1,
  },
  hint: {
    fontFamily: FONTS.hand,
    fontSize: 30,
    color: BRASS,
    marginBottom: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  labelMark: {
    position: 'absolute',
    top: DISC * 0.405,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  folded: {
    fontFamily: FONTS.monoMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: CREAM_SOFT,
  },
  glare: {
    position: 'absolute',
    top: '-30%',
    left: 0,
    width: 180,
  },
});
