import type { TrackId } from './scores';

// The real records, as the 30-second previews and cover art Apple serves for
// its store. They are streamed, never bundled: the masters and the covers are
// still under copyright.
interface Recording {
  appleId: number;
  // Surface noise under the preview, for the cards that are vinyl.
  vinyl: boolean;
  // When each chord of the form starts in the preview, as [seconds, index
  // into GIANT_STEPS_CHANGES], so the changes wheel follows the real band.
  changes?: Array<[number, number]>;
}

export const RECORDINGS: Record<TrackId, Recording> = {
  blueTrain: { appleId: 1468202479, vinyl: true },
  giantSteps: {
    appleId: 1531037503,
    vinyl: true,
    // Measured offline from the preview: a beat tracker found its 145 beats
    // (272 to 304 bpm as the band breathes), then each beat's bass and
    // harmony chroma were aligned to the 16-bar form with Viterbi. Six of
    // nine 16-beat windows fit best where the path puts them; the other three
    // are the weakest matches.
    // prettier-ignore
    changes: [
      [0.104, 5], [0.325, 6], [0.743, 7], [0.964, 8], [1.382, 9],
      [1.788, 10], [2.206, 11], [3.03, 12], [3.448, 13], [3.866, 14],
      [4.69, 15], [5.097, 16], [5.503, 17], [6.304, 18], [6.711, 19],
      [7.129, 20], [7.953, 21], [8.371, 22], [8.777, 23], [9.601, 24],
      [10.019, 25], [10.437, 0], [10.855, 1], [11.273, 2], [11.691, 3],
      [12.086, 4], [12.91, 5], [13.34, 6], [13.758, 7], [14.164, 8],
      [14.571, 9], [14.988, 10], [15.406, 11], [16.242, 12], [16.672, 13],
      [17.09, 14], [17.914, 15], [18.344, 16], [18.762, 17], [19.598, 18],
      [20.027, 19], [20.434, 20], [21.281, 21], [21.687, 22], [22.105, 23],
      [22.918, 24], [23.336, 25], [23.742, 0], [24.16, 1], [24.578, 2],
      [24.985, 3], [25.379, 4], [26.192, 5], [26.622, 6], [27.04, 7],
      [27.434, 8], [27.852, 9], [28.27, 10], [28.688, 11], [29.513, 12],
    ],
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
