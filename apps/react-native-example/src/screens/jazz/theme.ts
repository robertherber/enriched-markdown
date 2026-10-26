import { Platform } from 'react-native';
import type { MarkdownStyle } from 'react-native-enriched-markdown';

export const NIGHT = '#100E0B';
export const SMOKE = '#1B1814';
export const SMOKE_EDGE = '#2C2721';
export const CREAM = '#F1E6D0';
export const CREAM_SOFT = '#A89A82';
export const BRASS = '#D9A441';
export const BLUE = '#2357B8';
export const ORANGE = '#E4672C';
export const RED = '#C7362B';
export const NEON = '#FF5A4E';

export const FONTS = {
  display: 'BebasNeue-Regular',
  neon: 'Monoton-Regular',
  title: 'Fraunces-SemiBold',
  body: 'Newsreader-Regular',
  bodyBold: 'Newsreader-SemiBold',
  bodyItalic: 'Newsreader-Italic',
  hand: 'Caveat-Regular',
  handBold: 'Caveat-Bold',
  mono: 'DMMono-Regular',
  monoMedium: 'DMMono-Medium',
};

// Brass selection. iOS tints the handles with it and fades the highlight
// itself; Android paints the highlight as given, so it gets a translucent one.
export const linerSelection = Platform.select({
  ios: { selectionColor: BRASS },
  default: {
    selectionColor: 'rgba(217, 164, 65, 0.35)',
    selectionHandleColor: BRASS,
  },
});

export const linerMarkdownStyle: MarkdownStyle = {
  paragraph: {
    fontFamily: FONTS.body,
    fontSize: 18,
    lineHeight: 27,
    color: CREAM,
    marginBottom: 16,
  },
  h1: {
    fontFamily: FONTS.display,
    fontSize: 78,
    lineHeight: 72,
    color: CREAM,
    marginBottom: 6,
  },
  h2: {
    fontFamily: FONTS.display,
    fontSize: 34,
    lineHeight: 36,
    color: BRASS,
    marginTop: 18,
    marginBottom: 10,
  },
  h3: {
    fontFamily: FONTS.monoMedium,
    fontSize: 12,
    lineHeight: 18,
    color: CREAM_SOFT,
    marginBottom: 20,
  },
  blockquote: {
    fontFamily: FONTS.bodyItalic,
    fontSize: 21,
    lineHeight: 29,
    color: CREAM,
    borderColor: BRASS,
    borderWidth: 2,
    gapWidth: 16,
    backgroundColor: 'transparent',
    marginTop: 4,
    marginBottom: 20,
  },
  strong: { fontFamily: FONTS.bodyBold, fontWeight: 'normal', color: BRASS },
  // On iOS `fontStyle: 'normal'` keeps the run's upright trait, which finds no
  // face in an italic-only family, so ask for italic there.
  em: {
    fontFamily: FONTS.bodyItalic,
    fontStyle: Platform.OS === 'ios' ? 'italic' : 'normal',
  },
  link: { color: BRASS, underline: true },
  image: { marginTop: 8, marginBottom: 22 },
  video: { marginTop: 8, marginBottom: 22 },
};
