import { StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { BRASS, FONTS } from './theme';

// The screen's own record label: an eighth note and the name in a rounded
// box, stamped on the sleeve, the records and the notes.
export function LabelMark({
  color = BRASS,
  scale = 1,
}: {
  color?: string;
  scale?: number;
}) {
  return (
    <View
      style={[
        styles.mark,
        {
          borderColor: color,
          borderWidth: 1.5 * scale,
          borderRadius: 5 * scale,
          paddingHorizontal: 7 * scale,
          paddingTop: 3 * scale,
          paddingBottom: 2 * scale,
          gap: 5 * scale,
        },
      ]}
      accessibilityLabel="Liner Notes"
    >
      <Svg width={10 * scale} height={16 * scale} viewBox="0 0 10 16">
        <Ellipse
          cx={4}
          cy={13.2}
          rx={3.1}
          ry={2.2}
          transform="rotate(-22 4 13.2)"
          fill={color}
        />
        <Path
          d="M6.1 1h1.3c0.4 2.2 2.6 3 2.6 5.8 0 1.3-0.5 2.3-1.1 3 0.4-0.9 0.6-1.7 0.4-2.6-0.3-1.5-1.4-2.4-1.9-2.6v8.2H6.1z"
          fill={color}
        />
      </Svg>
      <Text
        style={[
          styles.name,
          {
            color,
            fontSize: 16 * scale,
            lineHeight: 18 * scale,
            letterSpacing: 2 * scale,
          },
        ]}
      >
        LINER NOTES
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontFamily: FONTS.display,
  },
});
