export function isValidPath(path: unknown): path is [number, number][] {
  if (!Array.isArray(path) || path.length < 2) return false;
  const seen = new Set<string>();
  for (let i = 0; i < path.length; i++) {
    const cell = path[i];
    if (!Array.isArray(cell) || cell.length !== 2) return false;
    const [r, c] = cell;
    if (!Number.isInteger(r) || !Number.isInteger(c)) return false;
    const key = `${r},${c}`;
    if (seen.has(key)) return false;
    seen.add(key);
    if (i > 0) {
      const [pr, pc] = path[i - 1];
      const dr = Math.abs(r - pr);
      const dc = Math.abs(c - pc);
      const isAdjacent = (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
      if (!isAdjacent) return false;
    }
  }
  return true;
}
