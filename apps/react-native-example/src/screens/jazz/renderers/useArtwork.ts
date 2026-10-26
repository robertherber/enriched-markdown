import { useEffect, useState } from 'react';
import { artworkUrl } from '../audio/recordings';
import type { TrackId } from '../audio/harmony';

// The record's real cover from the store; null offline and until the lookup
// lands.
export function useArtwork(track: TrackId) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    artworkUrl(track)
      .then((url) => current && setUri(url))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [track]);

  return uri;
}
