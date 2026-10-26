import { memo, useEffect, useState, type ComponentType } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
  TextPath,
} from 'react-native-svg';
import type { MarkdownLinkBlock } from 'react-native-enriched-markdown';
import { useAnchor } from '../anchors';
import type { TrackId } from '../audio/harmony';
import { usePlayer, usePlayerState } from '../player';
import {
  BLUE,
  BRASS,
  CREAM,
  CREAM_SOFT,
  FONTS,
  NIGHT,
  ORANGE,
  RED,
  SMOKE,
  SMOKE_EDGE,
} from '../theme';
import { CUE_DELAY_MS, SETTLE, SWING, formatTime, useEntrance } from './motion';
import { SourceNote } from './SourceNote';
import { useArtwork } from './useArtwork';

interface Album {
  track: TrackId;
  labelColor: string;
  labelInk: string;
  // Radii, out of 100, where the bands between side A's tracks fall.
  gaps: number[];
  personnel: string;
  Sleeve: ComponentType;
}

const ALBUMS: Record<string, Album> = {
  'blue-train': {
    track: 'blueTrain',
    labelColor: BLUE,
    labelInk: CREAM,
    gaps: [74, 56],
    personnel:
      'Lee Morgan, trumpet · Curtis Fuller, trombone · Kenny Drew, piano · Paul Chambers, bass · Philly Joe Jones, drums',
    Sleeve: BlueTrainSleeve,
  },
  'giant-steps': {
    track: 'giantSteps',
    labelColor: RED,
    labelInk: CREAM,
    gaps: [82, 68, 54],
    personnel:
      'Tommy Flanagan, piano · Paul Chambers, bass · Art Taylor, drums',
    Sleeve: GiantStepsSleeve,
  },
};

export function albumFor(url: string) {
  return ALBUMS[url.slice(url.lastIndexOf('/') + 1)];
}

// 33⅓ revolutions a minute.
const PLAY_DEG_PER_S = 200;

// A sleeve with the record peeking out. Play slides the disc out, spins it up
// and swings the tonearm in; stop lifts the arm and lets the platter coast.
export function Record({ block }: { block: MarkdownLinkBlock }) {
  const album = albumFor(block.url)!;
  const player = usePlayer();
  const playing = usePlayerState((s) => s.track === album.track);
  const loading = usePlayerState((s) => s.loading === album.track);
  const [width, setWidth] = useState(0);
  const [catalog = '', date = ''] = block.title.split(' · ');
  const anchor = useAnchor(album.track);

  const enter = useEntrance(700);
  const peek = useEntrance(900, 350, SETTLE);
  const out = useSharedValue(0);
  const arm = useSharedValue(0);
  const on = useSharedValue(0);
  const spin = useSharedValue(0);
  const speed = useSharedValue(0);

  useEffect(() => {
    on.value = playing ? 1 : 0;
    if (playing) {
      out.value = withTiming(1, { duration: 650, easing: SETTLE });
      arm.value = withDelay(
        350,
        withTiming(1, { duration: 900, easing: SWING })
      );
    } else {
      arm.value = withTiming(0, { duration: 600, easing: SWING });
      out.value = withDelay(
        500,
        withTiming(0, { duration: 700, easing: SETTLE })
      );
    }
  }, [playing, on, out, arm]);

  // The first card to land puts the music on, once its entrance has settled.
  const { cue } = player;
  useEffect(() => {
    const timer = setTimeout(cue, CUE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [cue]);

  // The platter spins up quickly and coasts down slowly, like a real one.
  useFrameCallback(({ timeSincePreviousFrame }) => {
    const dt = (timeSincePreviousFrame ?? 16) / 1000;
    const target = on.value * PLAY_DEG_PER_S;
    if (target === 0 && speed.value < 0.5) return;
    const lag = target > speed.value ? 0.35 : 0.9;
    speed.value += (target - speed.value) * (1 - Math.exp(-dt / lag));
    spin.value = (spin.value + speed.value * dt) % 360;
  });

  const S = width * 0.6;
  const D = S * 0.94;
  const restX = S * 0.36;
  const playX = width - D - width * 0.035;
  const armLength = S * 0.62;

  const cardStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: interpolate(enter.value, [0, 1], [26, 0]) }],
  }));
  const discStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          out.value,
          [0, 1],
          [interpolate(peek.value, [0, 1], [S * 0.06, restX]), playX]
        ),
      },
    ],
  }));
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));
  // The arm tracks inwards as the side plays.
  const armStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${interpolate(arm.value, [0, 1], [-4, 15]) + arm.value * player.progress.value * 6}deg`,
      },
    ],
  }));

  return (
    <Animated.View ref={anchor} style={[styles.card, cardStyle]}>
      <View
        style={styles.stage}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {width > 0 && (
          <>
            <Animated.View
              style={[
                styles.disc,
                { width: D, height: D, borderRadius: D / 2, top: (S - D) / 2 },
                discStyle,
              ]}
            >
              <Animated.View style={[StyleSheet.absoluteFill, spinStyle]}>
                <Vinyl
                  album={album}
                  label={`JOHN COLTRANE · ${block.label.toUpperCase()} · SIDE A · `}
                />
              </Animated.View>
              <Sheen />
            </Animated.View>
            <View style={[styles.sleeve, { width: S, height: S }]}>
              <Cover album={album} />
            </View>
            <Tonearm
              left={width - 18}
              top={S * 0.12}
              length={armLength}
              style={armStyle}
            />
          </>
        )}
      </View>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <View style={styles.titles}>
            <Text style={styles.title}>{block.label}</Text>
            <Text style={styles.catalog}>
              {`${catalog.toUpperCase()}  ·  ${date.toUpperCase()}`}
            </Text>
          </View>
          <PlayButton
            playing={playing}
            loading={loading}
            onPress={() => player.toggle(album.track)}
            label={block.label}
          />
        </View>
        <Text style={styles.personnel}>{album.personnel}</Text>
        <Progress
          playing={playing}
          progress={player.progress}
          elapsed={player.elapsed}
        />
        <SourceNote track={album.track} />
      </View>
    </Animated.View>
  );
}

export function PlayButton({
  playing,
  loading,
  onPress,
  label,
  size = 50,
}: {
  playing: boolean;
  loading: boolean;
  onPress: () => void;
  label: string;
  size?: number;
}) {
  const pressed = useSharedValue(0);
  const turn = useSharedValue(0);
  useEffect(() => {
    if (!loading) {
      cancelAnimation(turn);
      turn.value = 0;
      return;
    }
    turn.value = withRepeat(
      withTiming(360, { duration: 900, easing: Easing.linear }),
      -1
    );
  }, [loading, turn]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.08 }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value}deg` }],
  }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 80 });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: 180 });
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        playing || loading ? `Stop ${label}` : `Play ${label}`
      }
    >
      {loading && (
        <Animated.View
          style={[
            styles.cueing,
            {
              width: size + 10,
              height: size + 10,
              borderRadius: (size + 10) / 2,
            },
            ringStyle,
          ]}
        />
      )}
      <Animated.View
        style={[
          styles.play,
          { width: size, height: size, borderRadius: size / 2 },
          playing && styles.playOn,
          style,
        ]}
      >
        {playing ? (
          <View style={styles.stopGlyph} />
        ) : (
          <View style={styles.playGlyph} />
        )}
      </Animated.View>
    </Pressable>
  );
}

function Progress({
  playing,
  progress,
  elapsed,
}: {
  playing: boolean;
  progress: SharedValue<number>;
  elapsed: SharedValue<number>;
}) {
  const [time, setTime] = useState('0:00');
  useAnimatedReaction(
    () => (playing ? Math.floor(elapsed.value) : -1),
    (seconds, previous) => {
      if (seconds !== previous) {
        scheduleOnRN(setTime, seconds < 0 ? '0:00' : formatTime(seconds));
      }
    }
  );
  // A transform, not a width, so the bar moves without a layout pass.
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: playing ? progress.value : 0 }],
  }));
  return (
    <View>
      <View style={styles.progressRow}>
        <Text style={[styles.time, playing && styles.timeOn]}>{time}</Text>
        <View style={styles.track}>
          <Animated.View style={[styles.trackFill, fillStyle]} />
        </View>
        <Text style={styles.rpm}>33⅓ RPM</Text>
      </View>
    </View>
  );
}

const GROOVES = Array.from({ length: 38 }, (_, i) => 37 + i * 1.6);

const Vinyl = memo(function Vinyl({
  album,
  label,
}: {
  album: Album;
  label: string;
}) {
  const arcId = `arc-${album.track}`;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 200 200">
      <Defs>
        <Path id={arcId} d="M100 76 a24 24 0 1 1 -0.01 0" />
      </Defs>
      <Circle cx={100} cy={100} r={100} fill="#0B0A09" />
      {GROOVES.map((r, i) => (
        <Circle
          key={r}
          cx={100}
          cy={100}
          r={r}
          fill="none"
          stroke={i % 3 === 0 ? '#262320' : '#181614'}
          strokeWidth={0.7}
        />
      ))}
      {album.gaps.map((r) => (
        <G key={r}>
          <Circle
            cx={100}
            cy={100}
            r={r}
            fill="none"
            stroke="#050505"
            strokeWidth={2}
          />
          <Circle
            cx={100}
            cy={100}
            r={r + 1.3}
            fill="none"
            stroke="#34302B"
            strokeWidth={0.5}
          />
        </G>
      ))}
      <Circle
        cx={100}
        cy={100}
        r={98.6}
        fill="none"
        stroke="#2E2A26"
        strokeWidth={1.6}
      />
      <Circle cx={100} cy={100} r={34} fill={album.labelColor} />
      <Circle
        cx={100}
        cy={100}
        r={31}
        fill="none"
        stroke={album.labelInk}
        strokeOpacity={0.4}
        strokeWidth={0.6}
      />
      <SvgText
        fill={album.labelInk}
        fontFamily={FONTS.monoMedium}
        fontSize={5.6}
        letterSpacing={0.9}
      >
        <TextPath href={`#${arcId}`}>{label}</TextPath>
      </SvgText>
      <SvgText
        x={100}
        y={93}
        textAnchor="middle"
        fill={album.labelInk}
        fontFamily={FONTS.display}
        fontSize={9}
      >
        COLTRANE
      </SvgText>
      <SvgText
        x={100}
        y={114}
        textAnchor="middle"
        fill={album.labelInk}
        fillOpacity={0.75}
        fontFamily={FONTS.mono}
        fontSize={5}
      >
        33⅓
      </SvgText>
      <Circle cx={100} cy={100} r={3.4} fill={SMOKE} />
    </Svg>
  );
});

// The light on the grooves stays put while the record turns under it.
const Sheen = memo(function Sheen() {
  const wedge = (from: number, to: number) => {
    const point = (deg: number) => {
      const a = (deg * Math.PI) / 180;
      return `${100 + 98 * Math.cos(a)} ${100 + 98 * Math.sin(a)}`;
    };
    return `M100 100 L${point(from)} A98 98 0 0 1 ${point(to)} Z`;
  };
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox="0 0 200 200"
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient
          id="sheen"
          cx="100"
          cy="100"
          r="98"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0.36" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="0.75" stopColor="#FFFFFF" stopOpacity={0.13} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.02} />
        </RadialGradient>
      </Defs>
      <Path d={wedge(-70, -38)} fill="url(#sheen)" />
      <Path d={wedge(110, 142)} fill="url(#sheen)" />
    </Svg>
  );
});

function Tonearm({
  left,
  top,
  length,
  style,
}: {
  left: number;
  top: number;
  length: number;
  style: ReturnType<typeof useAnimatedStyle>;
}) {
  // Twice the arm's length and centred on the pivot, so a plain rotate turns
  // it around the pivot.
  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.arm,
          { left: left - 12, top: top - length, height: length * 2 },
          style,
        ]}
      >
        <View style={[styles.counterweight, { top: length - 30 }]} />
        <View style={[styles.rod, { top: length, height: length * 0.9 }]} />
        <View style={[styles.headshell, { top: length * 1.86 }]}>
          <View style={styles.stylus} />
        </View>
      </Animated.View>
      <View
        pointerEvents="none"
        style={[styles.pivot, { left: left - 15, top: top - 15 }]}
      >
        <View style={styles.pivotCore} />
      </View>
    </>
  );
}

// The real cover; the drawn sleeve stands under it until the art arrives.
function Cover({ album }: { album: Album }) {
  const uri = useArtwork(album.track);
  const shown = useSharedValue(0);
  useEffect(() => {
    if (!uri) shown.value = withTiming(0, { duration: 300 });
  }, [uri, shown]);
  const coverStyle = useAnimatedStyle(() => ({ opacity: shown.value }));

  return (
    <>
      <album.Sleeve />
      {uri && (
        <Animated.View style={[StyleSheet.absoluteFill, coverStyle]}>
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            accessibilityIgnoresInvertColors
            onLoad={() => {
              shown.value = withTiming(1, { duration: 450, easing: SETTLE });
            }}
          />
          <Svg
            style={StyleSheet.absoluteFill}
            viewBox="0 0 100 100"
            pointerEvents="none"
          >
            <Wear />
          </Svg>
        </Animated.View>
      )}
    </>
  );
}

function Wear() {
  return (
    <>
      <Circle
        cx={50}
        cy={50}
        r={45}
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity={0.07}
        strokeWidth={2.4}
      />
      <Path
        d="M0.6 0.6 H99.4 V99.4 H0.6 Z"
        fill="none"
        stroke="#000000"
        strokeOpacity={0.3}
        strokeWidth={1.2}
      />
    </>
  );
}

// Big stacked type over rails running off to the horizon.
function BlueTrainSleeve() {
  const vanish = { x: 90, y: 60 };
  const railA = { x: -16, y: 100 };
  const railB = { x: 44, y: 100 };
  const along = (from: { x: number; y: number }, u: number) => ({
    x: from.x + (vanish.x - from.x) * u,
    y: from.y + (vanish.y - from.y) * u,
  });
  const sleepers = Array.from(
    { length: 10 },
    (_, k) => 1 - 1 / (1.25 + k * 0.5)
  );
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="blueTrain" x1="0" y1="0" x2="0.4" y2="1">
          <Stop offset="0" stopColor="#2C66CF" />
          <Stop offset="1" stopColor="#123579" />
        </LinearGradient>
      </Defs>
      <Path d="M0 0 H100 V100 H0 Z" fill="url(#blueTrain)" />
      {sleepers.map((u, i) => {
        const a = along(railA, u);
        const b = along(railB, u);
        const spread = (b.x - a.x) * 0.16;
        return (
          <Path
            key={i}
            d={`M${a.x - spread} ${a.y} L${b.x + spread} ${b.y}`}
            stroke={CREAM}
            strokeOpacity={0.28}
            strokeWidth={2.6 * (1 - u)}
          />
        );
      })}
      {[railA, railB].map((rail, i) => (
        <Path
          key={i}
          d={`M${rail.x} ${rail.y} L${vanish.x} ${vanish.y}`}
          stroke={CREAM}
          strokeOpacity={0.85}
          strokeWidth={1.3}
        />
      ))}
      <SvgText
        x={7}
        y={11}
        fill={CREAM}
        fillOpacity={0.85}
        fontFamily={FONTS.monoMedium}
        fontSize={4.6}
        letterSpacing={1.2}
      >
        JOHN COLTRANE
      </SvgText>
      <SvgText
        x={6}
        y={44}
        fill={CREAM}
        fontFamily={FONTS.display}
        fontSize={38}
      >
        BLUE
      </SvgText>
      <SvgText
        x={6}
        y={70}
        fill="none"
        stroke={BRASS}
        strokeWidth={0.8}
        fontFamily={FONTS.display}
        fontSize={30}
      >
        TRAIN
      </SvgText>
      <SvgText
        x={94}
        y={95}
        textAnchor="end"
        fill={CREAM}
        fillOpacity={0.7}
        fontFamily={FONTS.mono}
        fontSize={3.8}
        letterSpacing={0.6}
      >
        BLP 1577
      </SvgText>
      <Wear />
    </Svg>
  );
}

// Three key centres a major third apart, climbing like stairs.
function GiantStepsSleeve() {
  const steps = [
    { x: 0, h: 22, fill: RED, name: 'B' },
    { x: 33.4, h: 38, fill: ORANGE, name: 'G' },
    { x: 66.8, h: 54, fill: NIGHT, name: 'E♭' },
  ];
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Path d="M0 0 H100 V100 H0 Z" fill="#EDE2CB" />
      {steps.map((step) => (
        <G key={step.name}>
          <Path
            d={`M${step.x} ${100 - step.h} h33.4 V100 H${step.x} Z`}
            fill={step.fill}
          />
          <SvgText
            x={step.x + 4}
            y={100 - step.h + 11}
            fill={CREAM}
            fontFamily={FONTS.display}
            fontSize={11}
          >
            {step.name}
          </SvgText>
        </G>
      ))}
      <SvgText
        x={6}
        y={11}
        fill={NIGHT}
        fillOpacity={0.8}
        fontFamily={FONTS.monoMedium}
        fontSize={4.6}
        letterSpacing={1.2}
      >
        JOHN COLTRANE
      </SvgText>
      <SvgText
        x={5}
        y={32}
        fill={NIGHT}
        fontFamily={FONTS.display}
        fontSize={27}
      >
        GIANT
      </SvgText>
      <SvgText
        x={5}
        y={56}
        fill={NIGHT}
        fontFamily={FONTS.display}
        fontSize={27}
      >
        STEPS
      </SvgText>
      <SvgText
        x={95}
        y={95}
        textAnchor="end"
        fill={CREAM}
        fillOpacity={0.75}
        fontFamily={FONTS.mono}
        fontSize={3.8}
        letterSpacing={0.6}
      >
        ATLANTIC 1311
      </SvgText>
      <Wear />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SMOKE,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SMOKE_EDGE,
    padding: 14,
    marginVertical: 4,
  },
  stage: {
    aspectRatio: 1 / 0.6,
  },
  disc: {
    position: 'absolute',
    left: 0,
    backgroundColor: '#0B0A09',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  sleeve: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 3,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 4, height: 8 },
    elevation: 8,
    backgroundColor: NIGHT,
  },
  arm: {
    position: 'absolute',
    width: 24,
  },
  counterweight: {
    position: 'absolute',
    left: 3,
    width: 18,
    height: 22,
    borderRadius: 5,
    backgroundColor: '#4F4A44',
    borderWidth: 1,
    borderColor: '#6C665E',
  },
  rod: {
    position: 'absolute',
    left: 10,
    width: 4,
    borderRadius: 2,
    backgroundColor: '#CFC8BA',
  },
  headshell: {
    position: 'absolute',
    left: 4,
    width: 16,
    height: 24,
    borderRadius: 3,
    backgroundColor: '#E8E1D2',
    transform: [{ rotate: '16deg' }],
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  stylus: {
    width: 6,
    height: 6,
    marginBottom: -3,
    borderRadius: 1,
    backgroundColor: BRASS,
  },
  pivot: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#8D877C',
    borderWidth: 3,
    borderColor: '#3B3732',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pivotCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#25221F',
  },
  info: {
    marginTop: 14,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titles: {
    flex: 1,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 36,
    lineHeight: 38,
    color: CREAM,
  },
  catalog: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    color: CREAM_SOFT,
  },
  personnel: {
    fontFamily: FONTS.bodyItalic,
    fontSize: 15,
    lineHeight: 21,
    color: CREAM_SOFT,
  },
  play: {
    backgroundColor: BRASS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOn: {
    backgroundColor: CREAM,
  },
  playGlyph: {
    width: 0,
    height: 0,
    marginLeft: 4,
    borderTopWidth: 9,
    borderBottomWidth: 9,
    borderLeftWidth: 15,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: NIGHT,
  },
  stopGlyph: {
    width: 15,
    height: 15,
    borderRadius: 2,
    backgroundColor: NIGHT,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  time: {
    fontFamily: FONTS.monoMedium,
    fontSize: 12,
    color: CREAM_SOFT,
    width: 34,
  },
  timeOn: {
    color: BRASS,
  },
  track: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: SMOKE_EDGE,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    backgroundColor: BRASS,
    transformOrigin: 'left',
  },
  rpm: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: CREAM_SOFT,
  },
  cueing: {
    position: 'absolute',
    top: -5,
    left: -5,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: BRASS,
    borderRightColor: BRASS,
  },
});
