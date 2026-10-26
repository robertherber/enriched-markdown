// The records, and the harmony the changes wheel follows.

export type TrackId = 'blueTrain' | 'giantSteps' | 'loveSupreme';

export type Quality = 'maj' | 'dom' | 'min';

export interface Chord {
  root: number;
  quality: Quality;
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

// One chord per entry, bar by bar, in the order the form plays them.
function chart(bars: Array<Array<[Key, Quality]>>): Chord[] {
  return bars.flat().map(([key, quality]) => ({ root: PC[key], quality }));
}

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
