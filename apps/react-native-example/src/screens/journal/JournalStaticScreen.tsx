import { memo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
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

// The Kyoto Journal as a finished answer: the whole document at once, no stream.
export default function JournalStaticScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <DotGrid />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.hanko}>
          <Text style={styles.hankoText}>旅</Text>
        </View>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>Kyoto Journal</Text>
          <Text style={styles.headerSub}>autumn · 3 days</Text>
        </View>
      </View>
      <ScrollView
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
          flavor="github"
          markdown={JOURNAL_MARKDOWN}
          markdownStyle={journalMarkdownStyle}
          renderers={journalRenderers}
        />
      </ScrollView>
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
  promptText: {
    fontFamily: FONTS.body,
    fontSize: 17,
    lineHeight: 23,
    color: PAPER,
  },
});
