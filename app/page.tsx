"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { savePlayer, loadWendLevel } from "@/lib/storage";
import { postJson } from "@/lib/postJson";

type GameType = "wyrdle" | "wend";

const GAMES: { id: GameType; title: string; description: string }[] = [
  { id: "wyrdle", title: "Fivefold", description: "Guess the hidden word before anyone else." },
  { id: "wend", title: "Snakeword", description: "Trace adjacent tiles to find every hidden word." },
];

export default function Home() {
  const router = useRouter();
  const [game, setGame] = useState<GameType | null>(null);
  const [showMultiplayer, setShowMultiplayer] = useState(false);

  const [createName, setCreateName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"solo" | "create" | "join" | null>(null);

  async function handleSolo() {
    if (!game) return;
    setPending("solo");
    setError(null);
    try {
      const data = await postJson<{
        room: { code: string };
        player: { id: string; name: string };
      }>("/api/rooms", {
        name: "Player",
        gameType: game,
        level: game === "wend" ? loadWendLevel() : undefined,
      });
      savePlayer(data.room.code, { playerId: data.player.id, name: data.player.name });
      router.push(`/room/${data.room.code}?solo=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPending(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!game) return;
    if (!createName.trim()) {
      setError("Enter your name first");
      return;
    }
    setPending("create");
    setError(null);
    try {
      const data = await postJson<{
        room: { code: string };
        player: { id: string; name: string };
      }>("/api/rooms", { name: createName.trim(), gameType: game });
      savePlayer(data.room.code, { playerId: data.player.id, name: data.player.name });
      router.push(`/room/${data.room.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPending(null);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinName.trim()) {
      setError("Enter your name first");
      return;
    }
    if (joinCode.trim().length < 4) {
      setError("Enter the game key");
      return;
    }
    setPending("join");
    setError(null);
    const code = joinCode.trim().toUpperCase();
    try {
      const data = await postJson<{ player: { id: string; name: string } }>(
        `/api/rooms/${code}/join`,
        { name: joinName.trim() },
      );
      savePlayer(code, { playerId: data.player.id, name: data.player.name });
      router.push(`/room/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPending(null);
    }
  }

  if (!game) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background px-4 py-16">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Wyrdly</h1>
            <p className="mt-2 text-sm text-foreground/60">Pick a game to play.</p>
          </div>
          <div className="space-y-3">
            {GAMES.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGame(g.id)}
                className="w-full rounded-lg border border-foreground/10 p-5 text-left transition-colors hover:border-foreground/30"
              >
                <h2 className="font-semibold text-foreground">{g.title}</h2>
                <p className="mt-1 text-sm text-foreground/60">{g.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setGame(null);
              setShowMultiplayer(false);
              setError(null);
            }}
            className="text-xs text-foreground/40 hover:text-foreground/70"
          >
            ← Choose a different game
          </button>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground">
            {GAMES.find((g) => g.id === game)?.title}
          </h1>
          <p className="mt-2 text-sm text-foreground/60">
            {GAMES.find((g) => g.id === game)?.description}
          </p>
        </div>

        <div className="flex rounded-lg border border-foreground/10 p-1">
          <button
            type="button"
            onClick={handleSolo}
            disabled={pending !== null}
            className="flex-1 rounded-md py-2 text-sm font-medium text-foreground/60 transition-colors hover:text-foreground disabled:opacity-50"
          >
            {pending === "solo" ? "Starting…" : "Single player"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowMultiplayer(true);
              setError(null);
            }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              showMultiplayer
                ? "bg-foreground text-background"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            Multiplayer
          </button>
        </div>

        {showMultiplayer && (
          <div className="space-y-8">
            <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-foreground/10 p-5">
              <h2 className="font-semibold text-foreground">Create a game</h2>
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Your name"
                maxLength={24}
                required
                autoFocus
                className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-foreground outline-none focus:border-foreground/40"
              />
              <button
                type="submit"
                disabled={pending !== null}
                className="w-full rounded-md bg-foreground px-4 py-2 font-medium text-background transition-opacity disabled:opacity-50"
              >
                {pending === "create" ? "Creating…" : "Create game"}
              </button>
            </form>

            <form onSubmit={handleJoin} className="space-y-3 rounded-lg border border-foreground/10 p-5">
              <h2 className="font-semibold text-foreground">Join a game</h2>
              <p className="text-xs text-foreground/50">
                Joining with a key opens whichever game that key belongs to.
              </p>
              <input
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="Your name"
                maxLength={24}
                required
                className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-foreground outline-none focus:border-foreground/40"
              />
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Game key"
                maxLength={6}
                required
                className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2 font-mono uppercase tracking-widest text-foreground outline-none focus:border-foreground/40"
              />
              <button
                type="submit"
                disabled={pending !== null}
                className="w-full rounded-md border border-foreground/20 px-4 py-2 font-medium text-foreground transition-opacity disabled:opacity-50"
              >
                {pending === "join" ? "Joining…" : "Join game"}
              </button>
            </form>
          </div>
        )}

        {error && <p className="text-center text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
}
