const PREFIX = "wordly:player:";

export interface StoredPlayer {
  playerId: string;
  name: string;
}

export function savePlayer(code: string, player: StoredPlayer) {
  try {
    localStorage.setItem(PREFIX + code.toUpperCase(), JSON.stringify(player));
  } catch {
    // ignore (private browsing, storage disabled, etc.)
  }
}

export function loadPlayer(code: string): StoredPlayer | null {
  try {
    const raw = localStorage.getItem(PREFIX + code.toUpperCase());
    if (!raw) return null;
    return JSON.parse(raw) as StoredPlayer;
  } catch {
    return null;
  }
}

const WEND_LEVEL_KEY = "wordly:wend:level";

export function loadWendLevel(): number {
  try {
    const raw = localStorage.getItem(WEND_LEVEL_KEY);
    const n = raw ? parseInt(raw, 10) : 1;
    return Number.isFinite(n) && n >= 1 ? n : 1;
  } catch {
    return 1;
  }
}

export function saveWendLevel(level: number) {
  try {
    localStorage.setItem(WEND_LEVEL_KEY, String(level));
  } catch {
    // ignore
  }
}
