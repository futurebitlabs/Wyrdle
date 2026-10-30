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
