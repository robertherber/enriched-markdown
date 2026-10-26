import type { MarkdownRenderers } from 'react-native-enriched-markdown';
import { ChangesWheel } from './ChangesWheel';
import { Marquee } from './Marquee';
import { Record, albumFor } from './Record';
import { TapeMachine } from './TapeMachine';

export const linerNotesRenderers: MarkdownRenderers = {
  image: (block) =>
    block.url.includes('/changes/') ? (
      <ChangesWheel block={block} />
    ) : undefined,
  link: (block) => {
    if (albumFor(block.url)) return <Record block={block} />;
    if (block.url.endsWith('/a-love-supreme'))
      return <TapeMachine block={block} />;
    if (block.url.includes('villagevanguard.com'))
      return <Marquee block={block} />;
    return undefined;
  },
};

// The card a block line of the source becomes, by the same rules as above,
// for the Duo's source page; null for a line that stays text.
export function rendererFor(line: string) {
  const target = line.match(/\]\(([^\s)]+)/)?.[1];
  if (!target) return null;
  if (line.startsWith('![')) {
    return target.includes('/changes/') ? 'ChangesWheel' : null;
  }
  if (line.startsWith('[')) {
    if (albumFor(target)) return 'Record';
    if (target.endsWith('/a-love-supreme')) return 'TapeMachine';
    if (target.includes('villagevanguard.com')) return 'Marquee';
  }
  return null;
}
