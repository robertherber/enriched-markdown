import type { VoiceName } from './synth';

// Original sketches over each record's harmony, not transcriptions: a blues
// in E♭ for Blue Train, the Giant Steps changes for Giant Steps, and a modal
// vamp in F for A Love Supreme.

export type TrackId = 'blueTrain' | 'giantSteps' | 'loveSupreme';

export type Quality = 'maj' | 'dom' | 'min';

export interface ScoreNote {
  at: number;
  len: number;
  voice: VoiceName;
  midi: number;
  vel: number;
}

export interface Chord {
  at: number;
  len: number;
  root: number;
  quality: Quality;
}

export interface Score {
  bpm: number;
  // Where the off-beat eighth lands inside the beat: 0.5 is straight.
  swing: number;
  beats: number;
  notes: ScoreNote[];
  chords: Chord[];
}

const PC = {
  C: 0,
  Db: 1,
  D: 2,
  Eb: 3,
  E: 4,
  F: 5,
  Gb: 6,
  G: 7,
  Ab: 8,
  A: 9,
  Bb: 10,
  B: 11,
};
type Key = keyof typeof PC;

export const NOTE_NAMES = [
  'C',
  'D♭',
  'D',
  'E♭',
  'E',
  'F',
  'F♯',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
];

// The lowest midi note of pitch class `pc` at or above `floor`.
function above(pc: number, floor: number) {
  return floor + ((((pc - floor) % 12) + 12) % 12);
}

function nearest(pc: number, to: number) {
  const up = above(pc, to);
  return up - to > 6 ? up - 12 : up;
}

function chart(bars: Array<Array<[Key, Quality]>>): Chord[] {
  const chords: Chord[] = [];
  bars.forEach((bar, i) => {
    const len = 4 / bar.length;
    bar.forEach(([key, quality], j) => {
      chords.push({ at: i * 4 + j * len, len, root: PC[key], quality });
    });
  });
  return chords;
}

const THIRD: Record<Quality, number> = { maj: 4, dom: 4, min: 3 };
const SEVENTH: Record<Quality, number> = { maj: 11, dom: 10, min: 10 };

function walkingBass(chords: Chord[], floor = 36): ScoreNote[] {
  const notes: ScoreNote[] = [];
  let last = floor + 6;
  chords.forEach((chord, i) => {
    const next = chords[(i + 1) % chords.length]!;
    const root = nearest(chord.root, last);
    const nextRoot = nearest(next.root, root);
    const approach = nextRoot + (i % 2 === 0 ? -1 : 1);
    const line =
      chord.len >= 4
        ? i % 2 === 0
          ? [root, root + THIRD[chord.quality], root + 7, approach]
          : [root, root + 7, root + 9, approach]
        : chord.len >= 2
          ? [root, approach]
          : [root];
    line.forEach((midi, beat) => {
      notes.push({
        at: chord.at + beat,
        len: 0.95,
        voice: 'bass',
        midi: midi < floor ? midi + 12 : midi > floor + 17 ? midi - 12 : midi,
        vel: beat === 0 ? 1 : 0.85,
      });
    });
    last = line[line.length - 1]!;
  });
  return notes;
}

const VOICING: Record<Quality, number[]> = {
  maj: [4, 7, 11, 14],
  dom: [4, 9, 10, 14],
  min: [3, 7, 10, 14],
};

function comping(chords: Chord[]): ScoreNote[] {
  const notes: ScoreNote[] = [];
  chords.forEach((chord, i) => {
    const shape = VOICING[chord.quality];
    const root = above(chord.root, 52 - shape[0]!);
    const hits =
      chord.len >= 4
        ? [
            { at: 0, len: 1.3, vel: 0.9 },
            { at: 2.5, len: 0.4, vel: 0.6 },
          ]
        : [{ at: i > 0 && i % 3 === 1 ? -0.5 : 0, len: 1.2, vel: 0.8 }];
    for (const hit of hits) {
      for (const offset of shape) {
        notes.push({
          at: chord.at + hit.at,
          len: hit.len,
          voice: 'piano',
          midi: root + offset,
          vel: hit.vel,
        });
      }
    }
  });
  return notes;
}

function swingKit(bars: number, fills: number[] = []): ScoreNote[] {
  const notes: ScoreNote[] = [];
  const hit = (at: number, voice: VoiceName, vel: number, midi = 0) =>
    notes.push({ at, len: 0.2, voice, midi, vel });
  for (let bar = 0; bar < bars; bar++) {
    const o = bar * 4;
    [0, 1, 1.5, 2, 3, 3.5].forEach((beat, i) =>
      hit(o + beat, 'ride', [0.75, 1, 0.55, 0.75, 1, 0.55][i]!)
    );
    hit(o + 1, 'hat', 0.8);
    hit(o + 3, 'hat', 0.8);
    for (let beat = 0; beat < 4; beat++) hit(o + beat, 'kick', 0.35);
    if (bar % 2 === 1) hit(o + 2.5, 'brush', 0.6);
    if (fills.includes(bar)) {
      hit(o + 3, 'tom', 0.8, 50);
      hit(o + 3 + 1 / 3, 'tom', 0.75, 47);
      hit(o + 3 + 2 / 3, 'tom', 0.9, 43);
    }
  }
  return notes;
}

function melody(
  phrase: Array<[number, number, number, number]>,
  voice: VoiceName = 'sax'
): ScoreNote[] {
  return phrase.map(([at, len, midi, vel]) => ({ at, len, voice, midi, vel }));
}

function score(
  bpm: number,
  swing: number,
  chords: Chord[],
  parts: ScoreNote[][]
): Score {
  const notes = parts.flat().sort((a, b) => a.at - b.at);
  const beats = chords.reduce((end, c) => Math.max(end, c.at + c.len), 0);
  return { bpm, swing, beats, notes, chords };
}

// Blue Train: a twelve-bar blues in E♭.
const BLUES = chart([
  [['Eb', 'dom']],
  [['Ab', 'dom']],
  [['Eb', 'dom']],
  [['Eb', 'dom']],
  [['Ab', 'dom']],
  [['Ab', 'dom']],
  [['Eb', 'dom']],
  [['Eb', 'dom']],
  [['Bb', 'dom']],
  [['Ab', 'dom']],
  [['Eb', 'dom']],
  [['Bb', 'dom']],
]);

const BLUES_HEAD = melody([
  [0, 1.5, 58, 0.9],
  [1.5, 0.5, 61, 0.8],
  [2, 1.5, 63, 1],
  [3.5, 0.5, 61, 0.75],
  [4, 2.6, 58, 0.9],
  [8.5, 0.5, 66, 0.85],
  [9, 0.5, 65, 0.8],
  [9.5, 0.5, 63, 0.8],
  [10, 0.5, 61, 0.8],
  [10.5, 0.5, 58, 0.75],
  [11, 1, 61, 0.85],
  [12, 3, 63, 1],
  [16, 1.5, 63, 0.9],
  [17.5, 0.5, 66, 0.85],
  [18, 1.5, 68, 1],
  [19.5, 0.5, 66, 0.8],
  [20, 2.6, 63, 0.9],
  [24.5, 0.5, 58, 0.8],
  [25, 0.5, 60, 0.8],
  [25.5, 0.5, 61, 0.8],
  [26, 0.5, 62, 0.85],
  [26.5, 0.5, 63, 0.85],
  [27, 1, 67, 1],
  [28, 0.5, 65, 0.85],
  [28.5, 0.5, 63, 0.8],
  [29, 0.5, 61, 0.8],
  [29.5, 2, 58, 0.9],
  [32, 1, 65, 1],
  [33, 0.5, 68, 0.9],
  [33.5, 0.5, 65, 0.8],
  [34, 1, 62, 0.9],
  [35, 1, 58, 0.8],
  [36, 2 / 3, 66, 0.85],
  [36 + 2 / 3, 2 / 3, 65, 0.8],
  [36 + 4 / 3, 2 / 3, 63, 0.8],
  [38, 2, 60, 0.9],
  [40, 2, 63, 1],
  [42, 0.5, 61, 0.8],
  [42.5, 0.5, 58, 0.8],
  [43, 1, 55, 0.85],
  [44, 0.5, 56, 0.8],
  [44.5, 0.5, 57, 0.8],
  [45, 2.5, 58, 0.9],
]);

// Giant Steps: key centres a major third apart, each reached by its dominant.
export const GIANT_STEPS_CHANGES = chart([
  [
    ['B', 'maj'],
    ['D', 'dom'],
  ],
  [
    ['G', 'maj'],
    ['Bb', 'dom'],
  ],
  [['Eb', 'maj']],
  [
    ['A', 'min'],
    ['D', 'dom'],
  ],
  [
    ['G', 'maj'],
    ['Bb', 'dom'],
  ],
  [
    ['Eb', 'maj'],
    ['Gb', 'dom'],
  ],
  [['B', 'maj']],
  [
    ['F', 'min'],
    ['Bb', 'dom'],
  ],
  [['Eb', 'maj']],
  [
    ['A', 'min'],
    ['D', 'dom'],
  ],
  [['G', 'maj']],
  [
    ['Db', 'min'],
    ['Gb', 'dom'],
  ],
  [['B', 'maj']],
  [
    ['F', 'min'],
    ['Bb', 'dom'],
  ],
  [['Eb', 'maj']],
  [
    ['Db', 'min'],
    ['Gb', 'dom'],
  ],
]);

// Coltrane's "1-2-3-5" cells, rising on one chord and falling on the next so
// the line stays in one register while the harmony jumps.
function patterns(chords: Chord[]): ScoreNote[] {
  const notes: ScoreNote[] = [];
  let last = 63;
  chords.forEach((chord, i) => {
    const third = THIRD[chord.quality];
    const rising = [0, 2, third, 7];
    const falling = [7, third, 2, 0];
    const cells =
      chord.len >= 4
        ? [rising, [12, SEVENTH[chord.quality], 7, third]]
        : [i % 2 === 0 ? rising : falling];
    const first = cells[0]![0]!;
    let root = nearest(chord.root, last - first);
    if (root + first > 74) root -= 12;
    if (root + first < 54) root += 12;
    cells.flat().forEach((offset, k, all) => {
      notes.push({
        at: chord.at + k * 0.5,
        len: k === all.length - 1 ? 0.6 : 0.5,
        voice: 'sax',
        midi: root + offset,
        vel: k % 4 === 0 ? 1 : 0.8,
      });
    });
    last = root + cells[cells.length - 1]![3]!;
  });
  return notes;
}

// A Love Supreme: a gong, a cymbal swell, a dorian bass vamp and quartal piano.
const VAMP = chart(Array.from({ length: 8 }, () => [['F', 'min']]));

const VAMP_BASS = Array.from({ length: 7 }, (_, i) => {
  const o = (i + 1) * 4;
  return melody(
    [
      [o, 1, 41, 1],
      [o + 1.5, 0.5, 48, 0.8],
      [o + 2, 1, 51, 0.9],
      [o + 3, 0.5, 50, 0.75],
      [o + 3.5, 0.5, 48, 0.8],
    ],
    'bass'
  );
}).flat();

const QUARTAL = [
  [53, 58, 63, 68],
  [55, 60, 65, 70],
];

const VAMP_PIANO = Array.from({ length: 7 }, (_, i) => {
  const o = (i + 1) * 4;
  const shape = QUARTAL[Math.floor(i / 2) % 2]!;
  return shape.flatMap((midi) =>
    melody(
      [
        [o, 2.5, midi, 0.8],
        [o + 2.5, 0.5, midi, 0.55],
      ],
      'piano'
    )
  );
}).flat();

const PSALM = melody([
  [8, 2.5, 60, 1],
  [10.5, 0.5, 58, 0.8],
  [11, 1, 60, 0.85],
  [12, 1.5, 63, 0.95],
  [13.5, 0.5, 65, 0.85],
  [14, 2, 68, 1],
  [16, 0.5, 65, 0.85],
  [16.5, 0.5, 63, 0.8],
  [17, 3, 60, 0.95],
  [20, 0.5, 58, 0.8],
  [20.5, 0.5, 60, 0.8],
  [21, 0.5, 63, 0.85],
  [21.5, 0.5, 65, 0.85],
  [22, 0.5, 68, 0.9],
  [22.5, 0.5, 70, 0.9],
  [23, 1, 72, 1],
  [24, 2, 70, 1],
  [26, 0.5, 68, 0.85],
  [26.5, 0.5, 65, 0.8],
  [27, 1, 63, 0.85],
  [28, 3.6, 65, 0.95],
]);

export const SCORES: Record<TrackId, Score> = {
  blueTrain: score(138, 0.64, BLUES, [
    BLUES_HEAD,
    walkingBass(BLUES, 36),
    comping(BLUES),
    swingKit(12, [3, 7, 11]),
  ]),
  giantSteps: score(236, 0.56, GIANT_STEPS_CHANGES, [
    patterns(GIANT_STEPS_CHANGES),
    walkingBass(GIANT_STEPS_CHANGES, 35),
    comping(GIANT_STEPS_CHANGES),
    swingKit(16),
  ]),
  loveSupreme: score(96, 0.6, VAMP, [
    melody([[0, 3, 41, 1]], 'gong'),
    melody([[0, 2.2, 0, 1]], 'swell'),
    VAMP_BASS,
    VAMP_PIANO,
    PSALM,
    swingKit(8, [3, 7]).filter((note) => note.at >= 4),
  ]),
};
