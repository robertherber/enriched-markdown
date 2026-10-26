import { Fragment, memo, useRef, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { rendererFor } from '../renderers';
import { BRASS, CREAM, CREAM_SOFT, FONTS } from '../theme';

const DIM = '#5E554A';

// The answer as it was written, line by line, beside the page it renders:
// each line that becomes a card is tagged with the renderer that draws it.
export function Source({
  markdown,
  streaming,
}: {
  markdown: string;
  streaming: boolean;
}) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const lines = markdown.split('\n');
  return (
    <ScrollView
      ref={scroll}
      style={styles.root}
      contentContainerStyle={styles.content}
      onContentSizeChange={() => scroll.current?.scrollToEnd()}
    >
      {lines.map((line, i) => (
        <Line
          key={i}
          number={i + 1}
          text={line}
          caret={streaming && i === lines.length - 1}
        />
      ))}
    </ScrollView>
  );
}

const Line = memo(function Line({
  number,
  text,
  caret,
}: {
  number: number;
  text: string;
  caret: boolean;
}) {
  const renderer = rendererFor(text);
  return (
    <View style={styles.line}>
      <Text style={styles.number}>{number}</Text>
      <View style={[styles.body, renderer && styles.block]}>
        <Text style={styles.text}>
          <Spans text={text} />
          {caret && <Text style={styles.caret}>▍</Text>}
        </Text>
        {renderer && <Text style={styles.tag}>{`→ <${renderer} />`}</Text>}
      </View>
    </View>
  );
});

// Markers dimmed, what they mark in the colour it renders in.
function Spans({ text }: { text: string }) {
  const heading = text.match(/^(#{1,6} )(.*)$/);
  if (heading) {
    return (
      <>
        <Text style={styles.marker}>{heading[1]}</Text>
        <Text style={styles.heading}>{heading[2]}</Text>
      </>
    );
  }
  const quote = text.match(/^(> )(.*)$/);
  if (quote) {
    return (
      <>
        <Text style={styles.quoteMarker}>{quote[1]}</Text>
        <Text style={styles.quote}>{quote[2]}</Text>
      </>
    );
  }
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) => {
        const bold = part.match(/^\*\*([^*]+)\*\*$/);
        const italic = !bold && part.match(/^\*([^*]+)\*$/);
        const marked = bold ?? italic;
        if (!marked) return <Fragment key={i}>{part}</Fragment>;
        const marker = bold ? '**' : '*';
        return (
          <Fragment key={i}>
            <Text style={styles.marker}>{marker}</Text>
            <Text style={bold ? styles.bold : styles.italic}>{marked[1]}</Text>
            <Text style={styles.marker}>{marker}</Text>
          </Fragment>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  line: {
    flexDirection: 'row',
    gap: 10,
  },
  number: {
    width: 22,
    textAlign: 'right',
    fontFamily: FONTS.mono,
    fontSize: 10,
    lineHeight: 19,
    color: '#3E3830',
  },
  body: {
    flex: 1,
    minHeight: 19,
  },
  block: {
    marginVertical: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderLeftWidth: 2,
    borderLeftColor: BRASS,
    backgroundColor: 'rgba(217, 164, 65, 0.08)',
    borderRadius: 3,
  },
  text: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    lineHeight: 19,
    color: CREAM_SOFT,
  },
  marker: {
    color: DIM,
  },
  heading: {
    fontFamily: FONTS.monoMedium,
    color: BRASS,
  },
  quoteMarker: {
    color: BRASS,
  },
  quote: {
    color: CREAM,
  },
  bold: {
    fontFamily: FONTS.monoMedium,
    color: BRASS,
  },
  italic: {
    color: CREAM,
  },
  tag: {
    alignSelf: 'flex-end',
    marginTop: 4,
    fontFamily: FONTS.monoMedium,
    fontSize: 10,
    letterSpacing: 0.6,
    color: BRASS,
  },
  caret: {
    color: BRASS,
  },
});
