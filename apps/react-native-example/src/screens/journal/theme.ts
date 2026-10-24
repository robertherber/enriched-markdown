import { Platform } from 'react-native';
import type { MarkdownStyle } from 'react-native-enriched-markdown';

export const PAPER = '#F7F1E6';
export const INK = '#2A211B';
export const INK_SOFT = '#7A6A5B';
export const VERMILION = '#C8442C';
export const MOSS = '#6E8B57';
export const RIVER = '#7FA7B8';

export const FONTS = {
  display: 'Fraunces-SemiBold',
  body: 'Newsreader-Regular',
  bodyBold: 'Newsreader-SemiBold',
  bodyItalic: 'Newsreader-Italic',
  hand: 'Caveat-Regular',
  handBold: 'Caveat-Bold',
  mono: 'DMMono-Regular',
  monoMedium: 'DMMono-Medium',
  mincho: Platform.select({ ios: 'Hiragino Mincho ProN', default: 'serif' }),
};

export const journalMarkdownStyle: MarkdownStyle = {
  paragraph: {
    fontFamily: FONTS.body,
    fontSize: 17,
    lineHeight: 25,
    color: INK,
    marginBottom: 14,
  },
  h1: {
    fontFamily: FONTS.display,
    fontSize: 34,
    lineHeight: 40,
    color: INK,
    marginBottom: 10,
  },
  h2: {
    fontFamily: FONTS.display,
    fontSize: 22,
    lineHeight: 28,
    color: VERMILION,
    marginTop: 14,
    marginBottom: 8,
  },
  strong: { fontFamily: FONTS.bodyBold, fontWeight: 'normal' },
  // On iOS `fontStyle: 'normal'` keeps the run's upright trait, which finds no
  // face in an italic-only family, so ask for italic there.
  em: {
    fontFamily: FONTS.bodyItalic,
    fontStyle: Platform.OS === 'ios' ? 'italic' : 'normal',
  },
  link: { color: VERMILION, underline: true },
  image: { marginTop: 6, marginBottom: 20 },
  video: { marginTop: 6, marginBottom: 20 },
};

// A stable pseudo-random number in [-1, 1] per string, so every polaroid keeps
// its tilt across re-renders.
export function jitter(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return ((hash % 1000) + 1000) / 1000 - 1;
}
