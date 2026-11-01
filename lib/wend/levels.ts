export interface WendLevel {
  gridSize: number;
  wordLengths: number[];
  label: "Easy" | "Medium" | "Hard";
  percent: number;
}

// Grid size and word-length mix for each level, tuned so puzzle generation
// succeeds reliably (see lib/wend/generate.ts) while still packing the grid
// tighter — and using longer words — as the level climbs.
const BASE_LEVELS: Omit<WendLevel, "label" | "percent">[] = [
  { gridSize: 4, wordLengths: [3, 4] },
  { gridSize: 4, wordLengths: [3, 3, 4] },
  { gridSize: 5, wordLengths: [4, 4, 5] },
  { gridSize: 5, wordLengths: [4, 5, 5] },
  { gridSize: 5, wordLengths: [3, 4, 5, 5] },
  { gridSize: 6, wordLengths: [4, 5, 5, 6] },
  { gridSize: 6, wordLengths: [4, 5, 6, 6] },
  { gridSize: 6, wordLengths: [4, 5, 6, 6, 7] },
  { gridSize: 6, wordLengths: [4, 5, 5, 6, 7] },
  { gridSize: 6, wordLengths: [3, 4, 4, 5, 6, 7] },
];

function labelFor(percent: number): WendLevel["label"] {
  if (percent < 40) return "Easy";
  if (percent < 75) return "Medium";
  return "Hard";
}

export const WEND_LEVELS: readonly WendLevel[] = BASE_LEVELS.map((level, i) => {
  const percent = Math.round(((i + 1) / BASE_LEVELS.length) * 100);
  return { ...level, percent, label: labelFor(percent) };
});

export function getWendLevel(levelNumber: number): WendLevel {
  const index = Math.min(Math.max(levelNumber, 1), WEND_LEVELS.length) - 1;
  return WEND_LEVELS[index];
}

// A fixed, moderate difficulty used for every multiplayer round (racing
// through a level ladder together doesn't make sense the way it does solo).
export const WEND_MULTIPLAYER_LEVEL = 6;
