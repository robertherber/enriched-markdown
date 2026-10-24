import { useEffect, useState } from 'react';
import { artworkUrl } from '../audio/recordings';
import type { TrackId } from '../audio/scores';
import { usePlayer } from '../player';

// The record's real cover from the store, only while the real records play;
// null for the sketches, offline, and until the lookup lands.
export function useArtwork(track: TrackId) {
  const { source } = usePlayer();
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    if (source !== 'recording') return;
    let current = true;
    artworkUrl(track)
      .then((url) => current && setUri(url))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [track, source]);

  return source === 'recording' ? uri : null;
}
