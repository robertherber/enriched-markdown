import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { useDemoStream } from '../shared/useDemoStream';
import { JOURNAL_MARKDOWN, PROMPT } from './journalMarkdown';
import { journalRenderers } from './renderers';
import {
  FONTS,
  INK,
  INK_SOFT,
  PAPER,
  VERMILION,
  journalMarkdownStyle,
} from './theme';

export default function JournalScreen() {
  const insets = useSafeAreaInsets();
  const stream = useDemoStream(JOURNAL_MARKDOWN);

  return (
    <View style={styles.root}>
      <DotGrid />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.hanko}>
          <Text style={styles.hankoText}>旅</Text>
        </View>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>Kyoto Journal</Text>
          <Text style={styles.headerSub}>
            {stream.writing ? 'writing…' : 'autumn · 3 days'}
          </Text>
        </View>
        <Pressable onPress={stream.replay} hitSlop={12} testID="journal-replay">
          <Text style={styles.replay}>↻ REPLAY</Text>
        </Pressable>
      </View>
      <Animated.ScrollView
        {...stream.scrollProps}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 120 },
        ]}
      >
        <View style={styles.prompt}>
          <Text style={styles.promptLabel}>YOU</Text>
          <Text style={styles.promptText}>{PROMPT}</Text>
        </View>
        <EnrichedMarkdownText
          key={stream.run}
          flavor="github"
          markdown={stream.markdown}
          markdownStyle={journalMarkdownStyle}
          renderers={journalRenderers}
          streamingAnimation={stream.streaming}
        />
        {!stream.streaming && <SignOff />}
      </Animated.ScrollView>
      {stream.streaming && stream.detached && (
        <Animated.View
          entering={FadeInDown.duration(220)}
          exiting={FadeOutDown.duration(180)}
          style={[styles.pillRow, { bottom: insets.bottom + 20 }]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={stream.follow}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Follow the answer"
            style={styles.pill}
          >
            <Text style={styles.pillText}>↓ still writing</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const THUMP = Easing.out(Easing.back(1.6));

// The journal signs itself once the answer is done: a note, then the hanko.
function SignOff() {
  const note = useSharedValue(0);
  const seal = useSharedValue(0);
  useEffect(() => {
    note.value = withDelay(200, withTiming(1, { duration: 600 }));
    seal.value = withDelay(
      750,
      withTiming(1, { duration: 420, easing: THUMP })
    );
  }, [note, seal]);

  const noteStyle = useAnimatedStyle(() => ({
    opacity: note.value,
    transform: [{ translateY: interpolate(note.value, [0, 1], [8, 0]) }],
  }));
  const sealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(seal.value, [0, 0.4, 1], [0, 0.95, 0.9]),
    transform: [
      { scale: interpolate(seal.value, [0, 1], [1.8, 1]) },
      { rotate: '-8deg' },
    ],
  }));

  return (
    <View style={styles.signOff}>
      <Animated.Text style={[styles.signOffNote, noteStyle]}>
        safe travels,
      </Animated.Text>
      <Animated.View style={[styles.signOffSeal, sealStyle]}>
        <Text style={styles.signOffSealText}>旅</Text>
      </Animated.View>
    </View>
  );
}

const DotGrid = memo(function DotGrid() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="dots" width={22} height={22} patternUnits="userSpaceOnUse">
          <Circle cx={11} cy={11} r={1.1} fill={INK} fillOpacity={0.1} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#dots)" />
    </Svg>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PAPER,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: 'rgba(247, 241, 230, 0.94)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DCCFB9',
    zIndex: 1,
  },
  hanko: {
    width: 38,
    height: 38,
    borderRadius: 6,
    borderWidth: 2.5,
    borderColor: VERMILION,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
  },
  hankoText: {
    fontFamily: FONTS.mincho,
    fontSize: 22,
    color: VERMILION,
    fontWeight: '700',
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: FONTS.display,
    fontSize: 22,
    color: INK,
  },
  headerSub: {
    fontFamily: FONTS.hand,
    fontSize: 18,
    color: INK_SOFT,
    marginTop: -2,
  },
  replay: {
    fontFamily: FONTS.monoMedium,
    fontSize: 12,
    letterSpacing: 1,
    color: VERMILION,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 20,
  },
  prompt: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    backgroundColor: INK,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 22,
  },
  promptLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: '#C9B9A4',
    marginBottom: 4,
  },
  signOff: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
    marginRight: 6,
  },
  signOffNote: {
    fontFamily: FONTS.hand,
    fontSize: 26,
    color: INK_SOFT,
  },
  signOffSeal: {
    width: 46,
    height: 46,
    borderRadius: 6,
    backgroundColor: VERMILION,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOffSealText: {
    fontFamily: FONTS.mincho,
    fontSize: 26,
    color: PAPER,
    fontWeight: '700',
  },
  pillRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    backgroundColor: INK,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pillText: {
    fontFamily: FONTS.monoMedium,
    fontSize: 12,
    letterSpacing: 1,
    color: PAPER,
  },
  promptText: {
    fontFamily: FONTS.body,
    fontSize: 17,
    lineHeight: 23,
    color: PAPER,
  },
});
