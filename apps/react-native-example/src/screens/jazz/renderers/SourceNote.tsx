import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { storeUrl } from '../audio/recordings';
import type { TrackId } from '../audio/harmony';
import { BRASS, FONTS } from '../theme';

// Says what is playing: Apple's preview of the real record, linked back to
// the store as its terms ask.
export function SourceNote({
  track,
  prefix,
}: {
  track: TrackId;
  prefix?: string;
}) {
  const lead = prefix ? `${prefix} · ` : '';
  return (
    <Pressable
      onPress={() => Linking.openURL(storeUrl(track))}
      hitSlop={8}
      accessibilityRole="link"
      accessibilityLabel="Listen on Apple Music"
    >
      <Text style={styles.note}>
        {`${lead}30-SECOND PREVIEW · `}
        <Text style={styles.link}>APPLE MUSIC ↗</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  note: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    lineHeight: 13,
    letterSpacing: 0.6,
    color: '#6E6352',
    marginTop: 8,
  },
  link: {
    color: BRASS,
  },
});
