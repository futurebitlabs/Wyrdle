"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { savePlayer } from "@/lib/storage";
import { postJson } from "@/lib/postJson";

type Mode = "solo" | "multiplayer";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("solo");

  const [soloName, setSoloName] = useState("");
  const [createName, setCreateName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"solo" | "create" | "join" | null>(null);

  async function handleSolo(e: React.FormEvent) {
    e.preventDefault();
    if (!soloName.trim()) {
      setError("Enter your name first");
      return;
    }
    setPending("solo");
    setError(null);
    try {
      const data = await postJson<{
        room: { code: string };
        player: { id: string; name: string };
      }>("/api/rooms", { name: soloName.trim() });
      savePlayer(data.room.code, { playerId: data.player.id, name: data.player.name });
      router.push(`/room/${data.room.code}?solo=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPending(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
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
      }>("/api/rooms", { name: createName.trim() });
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

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Wyrdle</h1>
          <p className="mt-2 text-sm text-foreground/60">
            Guess the word. Play solo, or share a key and race your friends.
          </p>
        </div>

        <div className="flex rounded-lg border border-foreground/10 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("solo");
              setError(null);
            }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              mode === "solo"
                ? "bg-foreground text-background"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            Single player
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("multiplayer");
              setError(null);
            }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              mode === "multiplayer"
                ? "bg-foreground text-background"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            Multiplayer
          </button>
        </div>

        {mode === "solo" ? (
          <form onSubmit={handleSolo} className="space-y-3 rounded-lg border border-foreground/10 p-5">
            <h2 className="font-semibold text-foreground">Play solo</h2>
            <input
              value={soloName}
              onChange={(e) => setSoloName(e.target.value)}
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
              {pending === "solo" ? "Starting…" : "Play solo"}
            </button>
          </form>
        ) : (
          <div className="space-y-8">
            <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-foreground/10 p-5">
              <h2 className="font-semibold text-foreground">Create a game</h2>
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Your name"
                maxLength={24}
                required
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
