import type { TrackId } from './scores';

// The real records, as the 30-second previews and cover art Apple serves for
// its store. They are streamed, never bundled: the masters and the covers are
// still under copyright.
interface Recording {
  appleId: number;
  // Surface noise under the preview, for the cards that are vinyl.
  vinyl: boolean;
  // Where the preview sits in the tune's form, measured from the preview
  // itself, so the changes wheel can follow the real band.
  sync?: { bpm: number; firstBeat: number; formBeat: number };
}

export const RECORDINGS: Record<TrackId, Recording> = {
  blueTrain: { appleId: 1468202479, vinyl: true },
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

interface StoreEntry {
  preview: string;
  artwork: string | null;
}

const entries = new Map<TrackId, Promise<StoreEntry>>();

function lookup(track: TrackId) {
  let entry = entries.get(track);
  if (!entry) {
    entry = fetch(
      `https://itunes.apple.com/lookup?id=${RECORDINGS[track].appleId}`
    )
      .then((response) => response.json())
      .then(
        (json: {
          results: Array<{ previewUrl?: string; artworkUrl100?: string }>;
        }) => {
          const result = json.results[0];
          if (!result?.previewUrl) throw new Error(`No preview for ${track}`);
          return {
            preview: result.previewUrl,
            // The store serves any size from the same path.
            artwork:
              result.artworkUrl100?.replace('100x100bb', '700x700bb') ?? null,
          };
        }
      );
    entry.catch(() => entries.delete(track));
    entries.set(track, entry);
  }
  return entry;
}

export function previewUrl(track: TrackId) {
  return lookup(track).then((entry) => entry.preview);
}

export function artworkUrl(track: TrackId) {
  return lookup(track).then((entry) => entry.artwork);
}
