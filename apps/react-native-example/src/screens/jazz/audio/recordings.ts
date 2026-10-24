import type { TrackId } from './scores';

// The real records, as the 30-second previews Apple serves for its store.
// They are streamed, never bundled: the masters are still under copyright.
interface Recording {
  appleId: number;
  // Surface noise under the preview, for the cards that are vinyl.
  vinyl: boolean;
  // Where the preview sits in the tune's form, measured from the preview
  // itself, so the changes wheel can follow the real band.
  sync?: { bpm: number; firstBeat: number; formBeat: number };
}

export const RECORDINGS: Record<TrackId, Recording> = {
  blueTrain: { appleId: 1636572782, vinyl: true },
  giantSteps: {
    appleId: 1531037503,
    vinyl: true,
    sync: { bpm: 289, firstBeat: 0.12, formBeat: 14 },
  },
  loveSupreme: { appleId: 1440713020, vinyl: false },
};

export function storeUrl(track: TrackId) {
  return `https://music.apple.com/us/song/${RECORDINGS[track].appleId}`;
}

const previews = new Map<TrackId, Promise<string>>();

export function previewUrl(track: TrackId) {
  let url = previews.get(track);
  if (!url) {
    url = fetch(
      `https://itunes.apple.com/lookup?id=${RECORDINGS[track].appleId}`
    )
      .then((response) => response.json())
      .then((json: { results: Array<{ previewUrl?: string }> }) => {
        const preview = json.results[0]?.previewUrl;
        if (!preview) throw new Error(`No preview for ${track}`);
        return preview;
      });
    url.catch(() => previews.delete(track));
    previews.set(track, url);
  }
  return url;
}
