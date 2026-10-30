"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { savePlayer } from "@/lib/storage";
import { postJson } from "@/lib/postJson";

export default function Home() {
  const router = useRouter();
  const [createName, setCreateName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"create" | "join" | null>(null);

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
      <div className="w-full max-w-sm space-y-10">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Wordly</h1>
          <p className="mt-2 text-sm text-foreground/60">
            A multiplayer word-guessing game. Create a game and share the key,
            or join one with a key a friend gave you.
          </p>
        </div>

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

        {error && <p className="text-center text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
}
