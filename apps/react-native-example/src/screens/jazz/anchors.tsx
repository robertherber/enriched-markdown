import {
  createContext,
  useContext,
  type ComponentRef,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { View } from 'react-native';
import type { TrackId } from './audio/harmony';

type Anchor = ComponentRef<typeof View>;
type Anchors = Map<TrackId, React.RefObject<Anchor | null>>;

const AnchorContext = createContext<Anchors | null>(null);

// Where each record's card sits in the notes, so the Duo's tracklist can jump
// to it. Without a provider the refs register nowhere.
export function AnchorProvider({
  anchors,
  children,
}: {
  anchors: Anchors;
  children: ReactNode;
}) {
  return (
    <AnchorContext.Provider value={anchors}>{children}</AnchorContext.Provider>
  );
}

export function useAnchor(id: TrackId) {
  const anchors = useContext(AnchorContext);
  const ref = useRef<Anchor>(null);
  useEffect(() => {
    if (!anchors) return;
    anchors.set(id, ref);
    return () => {
      if (anchors.get(id) === ref) anchors.delete(id);
    };
  }, [anchors, id]);
  return ref;
}
