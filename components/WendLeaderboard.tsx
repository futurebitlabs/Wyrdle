import type { PlayerInfo, WendFoundWord } from "@/lib/types";

interface WendLeaderboardProps {
  players: PlayerInfo[];
  foundByPlayer: Map<string, WendFoundWord[]>;
  winsByPlayer: Map<string, number>;
  localPlayerId: string;
}

export function WendLeaderboard({
  players,
  foundByPlayer,
  winsByPlayer,
  localPlayerId,
}: WendLeaderboardProps) {
  const ranks = players
    .map((player) => ({
      player,
      found: foundByPlayer.get(player.id)?.length ?? 0,
      wins: winsByPlayer.get(player.id) ?? 0,
    }))
    .sort((a, b) => (a.wins !== b.wins ? b.wins - a.wins : b.found - a.found));

  return (
    <div className="w-full max-w-xs space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">Players</h2>
      <ol className="space-y-1">
        {ranks.map((rank, i) => (
          <li
            key={rank.player.id}
            className={`flex items-center justify-between rounded px-3 py-2 text-sm ${
              rank.player.id === localPlayerId ? "bg-foreground/10" : "bg-foreground/5"
            }`}
          >
            <span className="flex items-center gap-2 text-foreground">
              <span className="text-foreground/40">{i + 1}.</span>
              {rank.player.name}
              {rank.player.isHost && <span className="text-xs text-foreground/40">(host)</span>}
            </span>
            <span className="flex items-center gap-2 text-xs text-foreground/60">
              <span className="font-semibold text-foreground/80">
                {rank.wins} {rank.wins === 1 ? "win" : "wins"}
              </span>
              <span>
                {rank.found} {rank.found === 1 ? "word" : "words"}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
