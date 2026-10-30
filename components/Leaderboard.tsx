import type { GuessRow, PlayerInfo } from "@/lib/types";

interface LeaderboardProps {
  players: PlayerInfo[];
  guessesByPlayer: Map<string, GuessRow[]>;
  winsByPlayer: Map<string, number>;
  maxGuesses: number;
  localPlayerId: string;
}

interface Rank {
  player: PlayerInfo;
  attempts: number;
  solved: boolean;
  outOfGuesses: boolean;
  solvedAt: string | null;
  wins: number;
}

export function Leaderboard({
  players,
  guessesByPlayer,
  winsByPlayer,
  maxGuesses,
  localPlayerId,
}: LeaderboardProps) {
  const ranks: Rank[] = players.map((player) => {
    const guesses = guessesByPlayer.get(player.id) ?? [];
    const winning = guesses.find((g) => g.isCorrect);
    return {
      player,
      attempts: guesses.length,
      solved: Boolean(winning),
      outOfGuesses: !winning && guesses.length >= maxGuesses,
      solvedAt: winning?.createdAt ?? null,
      wins: winsByPlayer.get(player.id) ?? 0,
    };
  });

  ranks.sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins;
    if (a.solved !== b.solved) return a.solved ? -1 : 1;
    if (a.solved && b.solved) {
      if (a.attempts !== b.attempts) return a.attempts - b.attempts;
      return (a.solvedAt ?? "").localeCompare(b.solvedAt ?? "");
    }
    if (a.outOfGuesses !== b.outOfGuesses) return a.outOfGuesses ? 1 : -1;
    return b.attempts - a.attempts;
  });

  return (
    <div className="w-full max-w-xs space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
        Players
      </h2>
      <ol className="space-y-1">
        {ranks.map((rank, i) => (
          <li
            key={rank.player.id}
            className={`flex items-center justify-between rounded px-3 py-2 text-sm ${
              rank.player.id === localPlayerId
                ? "bg-foreground/10"
                : "bg-foreground/5"
            }`}
          >
            <span className="flex items-center gap-2 text-foreground">
              <span className="text-foreground/40">{i + 1}.</span>
              {rank.player.name}
              {rank.player.isHost && (
                <span className="text-xs text-foreground/40">(host)</span>
              )}
            </span>
            <span className="flex items-center gap-2 text-xs text-foreground/60">
              <span className="font-semibold text-foreground/80">
                {rank.wins} {rank.wins === 1 ? "win" : "wins"}
              </span>
              <span>
                {rank.solved
                  ? `solved in ${rank.attempts}`
                  : rank.outOfGuesses
                    ? "out of guesses"
                    : `${rank.attempts}/${maxGuesses}`}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
