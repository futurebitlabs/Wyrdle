import { WEND_WORDS_BY_LENGTH } from "@/lib/wendWords";
import type { WendLevel } from "./levels";

export type WendCell = string | null; // uppercase letter, or null = blocked

export interface WendPlacedWord {
  word: string;
  path: [number, number][];
}

export interface WendPuzzle {
  gridSize: number;
  cells: WendCell[][];
  words: WendPlacedWord[];
}

function mulberry32(seed: number) {
  let state = seed | 0;
  return function rng() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function neighbors(r: number, c: number, size: number): [number, number][] {
  const out: [number, number][] = [];
  if (r > 0) out.push([r - 1, c]);
  if (r < size - 1) out.push([r + 1, c]);
  if (c > 0) out.push([r, c - 1]);
  if (c < size - 1) out.push([r, c + 1]);
  return out;
}

// Backtracking random-path search for `length` cells, avoiding `occupied`.
function findPath(
  size: number,
  length: number,
  occupied: Set<string>,
  rng: () => number,
  maxSteps: number,
): [number, number][] | null {
  let steps = 0;
  const visited = new Set<string>();

  function backtrack(path: [number, number][]): [number, number][] | null {
    steps++;
    if (steps > maxSteps) return null;
    if (path.length === length) return path;
    const [r, c] = path[path.length - 1];
    for (const [nr, nc] of shuffle(neighbors(r, c, size), rng)) {
      const key = `${nr},${nc}`;
      if (occupied.has(key) || visited.has(key)) continue;
      visited.add(key);
      path.push([nr, nc]);
      const result = backtrack(path);
      if (result) return result;
      path.pop();
      visited.delete(key);
      if (steps > maxSteps) return null;
    }
    return null;
  }

  const free: [number, number][] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!occupied.has(`${r},${c}`)) free.push([r, c]);
    }
  }

  for (const [r, c] of shuffle(free, rng)) {
    if (steps > maxSteps * 3) break;
    visited.clear();
    visited.add(`${r},${c}`);
    const result = backtrack([[r, c]]);
    if (result) return result;
  }
  return null;
}

function attemptPuzzle(level: WendLevel, rng: () => number): WendPuzzle | null {
  const { gridSize, wordLengths } = level;
  const occupied = new Set<string>();
  const placed: WendPlacedWord[] = [];
  const usedWords = new Set<string>();

  for (const length of [...wordLengths].sort((a, b) => b - a)) {
    const path = findPath(gridSize, length, occupied, rng, 400);
    if (!path) return null;

    const pool = WEND_WORDS_BY_LENGTH[length] ?? [];
    const candidates = shuffle(pool, rng);
    const word = candidates.find((w) => !usedWords.has(w)) ?? candidates[0];
    if (!word) return null;

    usedWords.add(word);
    for (const [r, c] of path) occupied.add(`${r},${c}`);
    placed.push({ word, path });
  }

  const cells: WendCell[][] = Array.from({ length: gridSize }, (_, r) =>
    Array.from({ length: gridSize }, (_, c) => (occupied.has(`${r},${c}`) ? "#" : null)),
  );
  for (const { word, path } of placed) {
    path.forEach(([r, c], i) => {
      cells[r][c] = word[i].toUpperCase();
    });
  }
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (cells[r][c] === "#") cells[r][c] = null;
    }
  }

  return { gridSize, cells, words: placed };
}

export function generateWendPuzzle(level: WendLevel, seed = Date.now() ^ Math.floor(Math.random() * 1e9)): WendPuzzle {
  for (let attempt = 0; attempt < 25; attempt++) {
    const rng = mulberry32(seed + attempt * 7919);
    const puzzle = attemptPuzzle(level, rng);
    if (puzzle && puzzle.words.length === level.wordLengths.length) {
      return puzzle;
    }
  }
  throw new Error("Could not generate Wend puzzle for level after 25 attempts");
}
