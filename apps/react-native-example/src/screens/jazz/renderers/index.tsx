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
  video: (block) =>
    block.url.includes('/sessions/') ? (
      <TapeMachine block={block} />
    ) : undefined,
  link: (block) => {
    if (albumFor(block.url)) return <Record block={block} />;
    if (block.url.includes('villagevanguard.com'))
      return <Marquee block={block} />;
    return undefined;
  },
};
