"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { loadPlayer, savePlayer, saveWendLevel } from "@/lib/storage";
import { postJson } from "@/lib/postJson";
import type { PlayerInfo, RoomInfo, RoundStatus, WendFoundWord, WendRoundInfo } from "@/lib/types";
import type { WendCell } from "@/lib/wend/generate";
import { WendBoard } from "./WendBoard";
import { WendLeaderboard } from "./WendLeaderboard";

type Status = "loading" | "needs-name" | "ready" | "not-found";

const FOUND_WORD_COLORS = [
  "#3b82f6",
  "#f43f5e",
  "#f97316",
  "#a855f7",
  "#14b8a6",
  "#ec4899",
  "#06b6d4",
  "#22c55e",
];

interface PlayerRow {
  id: string;
  name: string;
  is_host: boolean;
}

interface WendStateRow {
  round_id: string;
  room_id: string;
  round_number: number;
  level_number: number;
  status: RoundStatus;
  grid_size: number;
  cells: WendCell[][];
  word_lengths: number[];
  words: string[] | null;
  winner_player_id: string | null;
  started_at: string;
  finished_at: string | null;
}

interface WendFoundWordRow {
  id: string;
  round_id: string;
  player_id: string;
  word: string;
  path: [number, number][];
  found_at: string;
}

function toPlayerInfo(row: PlayerRow): PlayerInfo {
  return { id: row.id, name: row.name, isHost: row.is_host };
}

function toRoundInfo(row: WendStateRow): WendRoundInfo {
  return {
    roundId: row.round_id,
    roomId: row.room_id,
    roundNumber: row.round_number,
    levelNumber: row.level_number,
    status: row.status,
    gridSize: row.grid_size,
    cells: row.cells,
    wordLengths: row.word_lengths,
    words: row.words,
    winnerPlayerId: row.winner_player_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

function toFoundWord(row: WendFoundWordRow): WendFoundWord {
  return {
    id: row.id,
    roundId: row.round_id,
    playerId: row.player_id,
    word: row.word,
    path: row.path,
    foundAt: row.found_at,
  };
}

export function WendClient({ code, solo = false }: { code: string; solo?: boolean }) {
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [rounds, setRounds] = useState<WendRoundInfo[]>([]);
  const [found, setFound] = useState<WendFoundWord[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [startingRound, setStartingRound] = useState(false);
  const [hint, setHint] = useState<[number, number] | null>(null);
  const [hintPending, setHintPending] = useState(false);

  const joinRoom = useCallback(
    (payload: { name?: string; playerId?: string }) =>
      postJson<{ room: RoomInfo; player: PlayerInfo }>(`/api/rooms/${code}/join`, payload),
    [code],
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const stored = loadPlayer(code);
      if (!stored) {
        setStatus("needs-name");
        return;
      }
      try {
        const data = await joinRoom({ playerId: stored.playerId });
        if (cancelled) return;
        setRoom(data.room);
        setPlayer(data.player);
        setStatus("ready");
      } catch {
        if (cancelled) return;
        setStatus("needs-name");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [code, joinRoom]);

  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameInput.trim()) return;
    try {
      const data = await joinRoom({ name: nameInput.trim() });
      savePlayer(code, { playerId: data.player.id, name: data.player.name });
      setRoom(data.room);
      setPlayer(data.player);
      setStatus("ready");
    } catch (err) {
      setStatus("not-found");
      setErrorMessage(err instanceof Error ? err.message : "Could not join");
    }
  }

  useEffect(() => {
    if (!room) return;
    let cancelled = false;

    const supabase = getSupabaseClient();

    async function loadInitialState() {
      const [playersRes, roundsRes, foundRes] = await Promise.all([
        supabase.from("players").select("id, name, is_host").eq("room_id", room!.id),
        supabase
          .from("wend_state")
          .select("*")
          .eq("room_id", room!.id)
          .order("round_number", { ascending: true }),
        supabase.from("wend_found_words").select("*").eq("room_id", room!.id),
      ]);
      if (cancelled) return;
      if (playersRes.data) setPlayers((playersRes.data as PlayerRow[]).map(toPlayerInfo));
      if (roundsRes.data) setRounds((roundsRes.data as WendStateRow[]).map(toRoundInfo));
      if (foundRes.data) setFound((foundRes.data as WendFoundWordRow[]).map(toFoundWord));
    }

    loadInitialState();

    const channel = supabase
      .channel(`wend-room:${room.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "players", filter: `room_id=eq.${room.id}` },
        (payload) => {
          const row = toPlayerInfo(payload.new as PlayerRow);
          setPlayers((prev) => (prev.some((p) => p.id === row.id) ? prev : [...prev, row]));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wend_state", filter: `room_id=eq.${room.id}` },
        (payload) => {
          const row = toRoundInfo(payload.new as WendStateRow);
          setRounds((prev) => (prev.some((r) => r.roundId === row.roundId) ? prev : [...prev, row]));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "wend_state", filter: `room_id=eq.${room.id}` },
        (payload) => {
          const row = toRoundInfo(payload.new as WendStateRow);
          setRounds((prev) => prev.map((r) => (r.roundId === row.roundId ? row : r)));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wend_found_words", filter: `room_id=eq.${room.id}` },
        (payload) => {
          const row = toFoundWord(payload.new as WendFoundWordRow);
          setFound((prev) => (prev.some((f) => f.id === row.id) ? prev : [...prev, row]));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "wend_found_words", filter: `room_id=eq.${room.id}` },
        (payload) => {
          const old = payload.old as { id?: string };
          if (old.id) setFound((prev) => prev.filter((f) => f.id !== old.id));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [room]);

  const currentRound = useMemo(
    () =>
      rounds.reduce<WendRoundInfo | null>(
        (latest, r) => (!latest || r.roundNumber > latest.roundNumber ? r : latest),
        null,
      ),
    [rounds],
  );

  const [hintRoundId, setHintRoundId] = useState<string | undefined>(currentRound?.roundId);
  if (currentRound?.roundId !== hintRoundId) {
    setHintRoundId(currentRound?.roundId);
    setHint(null);
  }

  const currentFound = useMemo(
    () => found.filter((f) => f.roundId === currentRound?.roundId),
    [found, currentRound],
  );

  const lockedCells = useMemo(() => {
    const set = new Set<string>();
    for (const f of currentFound) {
      for (const [r, c] of f.path) set.add(`${r},${c}`);
    }
    return set;
  }, [currentFound]);

  const foundColorById = useMemo(() => {
    const sorted = [...currentFound].sort((a, b) => a.foundAt.localeCompare(b.foundAt));
    const map = new Map<string, string>();
    sorted.forEach((f, i) => map.set(f.id, FOUND_WORD_COLORS[i % FOUND_WORD_COLORS.length]));
    return map;
  }, [currentFound]);

  const foundPaths = useMemo(
    () =>
      currentFound.map((f) => ({
        path: f.path,
        color: foundColorById.get(f.id) ?? FOUND_WORD_COLORS[0],
      })),
    [currentFound, foundColorById],
  );

  const foundByPlayer = useMemo(() => {
    const map = new Map<string, WendFoundWord[]>();
    for (const f of currentFound) {
      const list = map.get(f.playerId) ?? [];
      list.push(f);
      map.set(f.playerId, list);
    }
    return map;
  }, [currentFound]);

  const winsByPlayer = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rounds) {
      if (r.status === "finished" && r.winnerPlayerId) {
        map.set(r.winnerPlayerId, (map.get(r.winnerPlayerId) ?? 0) + 1);
      }
    }
    return map;
  }, [rounds]);

  const isGameOver = currentRound?.status === "finished";
  const isSolo = solo && players.length <= 1;
  const winner = useMemo(
    () => players.find((p) => p.id === currentRound?.winnerPlayerId) ?? null,
    [players, currentRound],
  );

  const submitPath = useCallback(
    async (path: [number, number][]) => {
      if (!player || !currentRound || isGameOver) return;
      try {
        await postJson(`/api/rooms/${code}/wend/find`, { playerId: player.id, path });
      } catch (err) {
        setBanner(err instanceof Error ? err.message : "Not a hidden word");
        setTimeout(() => setBanner(null), 1500);
      }
    },
    [player, currentRound, code, isGameOver],
  );

  const getHint = useCallback(async () => {
    if (!player || isGameOver || hint || hintPending) return;
    setHintPending(true);
    try {
      const data = await postJson<{ hint: { row: number; col: number } }>(
        `/api/rooms/${code}/wend/hint`,
        { playerId: player.id },
      );
      setHint([data.hint.row, data.hint.col]);
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Could not get hint");
      setTimeout(() => setBanner(null), 2000);
    } finally {
      setHintPending(false);
    }
  }, [player, code, isGameOver, hint, hintPending]);

  const myFoundCount = useMemo(
    () => currentFound.filter((f) => f.playerId === player?.id).length,
    [currentFound, player],
  );

  const [undoing, setUndoing] = useState(false);
  const handleUndo = useCallback(async () => {
    if (!player || isGameOver || myFoundCount === 0 || undoing) return;
    setUndoing(true);
    try {
      const data = await postJson<{ removed: string }>(`/api/rooms/${code}/wend/undo`, {
        playerId: player.id,
      });
      setFound((prev) => {
        const idx = [...prev]
          .reverse()
          .findIndex((f) => f.playerId === player.id && f.word === data.removed);
        if (idx === -1) return prev;
        const realIdx = prev.length - 1 - idx;
        return prev.filter((_, i) => i !== realIdx);
      });
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Could not undo");
      setTimeout(() => setBanner(null), 2000);
    } finally {
      setUndoing(false);
    }
  }, [player, code, isGameOver, myFoundCount, undoing]);

  async function handlePlayAgain() {
    if (!player) return;
    setStartingRound(true);
    try {
      const nextLevel = isSolo
        ? Math.min((currentRound?.levelNumber ?? 1) + 1, 10)
        : undefined;
      await postJson(`/api/rooms/${code}/rounds`, { playerId: player.id, level: nextLevel });
      if (isSolo && nextLevel) saveWendLevel(nextLevel);
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Could not start new round");
      setTimeout(() => setBanner(null), 2000);
    } finally {
      setStartingRound(false);
    }
  }

  if (status === "loading") return <Centered>Loading…</Centered>;
  if (status === "not-found") return <Centered>{errorMessage ?? `Game ${code} not found.`}</Centered>;

  if (status === "needs-name") {
    return (
      <Centered>
        <form onSubmit={handleNameSubmit} className="w-full max-w-xs space-y-3">
          <h1 className="text-center text-2xl font-bold text-foreground">Join game {code}</h1>
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Your name"
            maxLength={24}
            className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-foreground outline-none focus:border-foreground/40"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-foreground px-4 py-2 font-medium text-background"
          >
            Join
          </button>
        </form>
      </Centered>
    );
  }

  if (!room || !player || !currentRound) return <Centered>Something went wrong.</Centered>;

  const allWordsFound = currentFound.length >= currentRound.wordLengths.length;

  return (
    <div className="flex flex-1 flex-col bg-background px-4 pb-8 pt-5">
      {banner && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <p className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">
            {banner}
          </p>
        </div>
      )}

      <div className="flex w-full items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/40">
            {isSolo ? "Solo" : "Game key"} · Level {currentRound.levelNumber}
          </p>
          <p className="font-mono text-lg font-bold tracking-widest text-foreground">{room.code}</p>
        </div>
        {isSolo && (
          <p className="max-w-[45%] text-right text-[11px] leading-tight text-foreground/40">
            Share this key to invite others
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-1 flex-col items-center gap-8 md:flex-row md:items-start md:justify-center">
        <div className="w-full max-w-[300px] space-y-4 rounded-3xl bg-foreground/[0.03] p-4">
          <WendBoard
            cells={currentRound.cells}
            gridSize={currentRound.gridSize}
            lockedCells={lockedCells}
            foundPaths={foundPaths}
            hintCell={hint}
            disabled={isGameOver}
            onSubmit={submitPath}
          />

          <WordSlots
            wordLengths={currentRound.wordLengths}
            found={currentFound}
            players={players}
            showNames={!isSolo}
            colorById={foundColorById}
          />

          {!isGameOver && !allWordsFound && (
            <div className="flex justify-center gap-2">
              <button
                onClick={handleUndo}
                disabled={myFoundCount === 0 || undoing}
                className="rounded-full border border-foreground/15 px-4 py-1.5 text-sm font-medium text-foreground transition-opacity disabled:opacity-40"
              >
                {undoing ? "Undoing…" : "Undo"}
              </button>
              <button
                onClick={getHint}
                disabled={hintPending || Boolean(hint)}
                className="rounded-full border border-foreground/15 px-4 py-1.5 text-sm font-medium text-foreground transition-opacity disabled:opacity-40"
              >
                {hintPending ? "Getting hint…" : hint ? "Hint used" : "Get a hint"}
              </button>
            </div>
          )}
        </div>

        {!isSolo && (
          <WendLeaderboard
            players={players}
            foundByPlayer={foundByPlayer}
            winsByPlayer={winsByPlayer}
            localPlayerId={player.id}
          />
        )}
      </div>

      {isGameOver && (
        <div className="mt-6 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground/80">
              {isSolo
                ? "Level cleared!"
                : winner
                  ? (
                      <>
                        <span className="font-semibold">{winner.name}</span> found the most words!
                      </>
                    )
                  : "Round over."}
            </p>
            {currentRound.words && (
              <p className="mt-0.5 text-xs text-foreground/50">
                Words: <span className="uppercase">{currentRound.words.join(", ")}</span>
              </p>
            )}
            {!player.isHost && (
              <p className="mt-0.5 text-xs text-foreground/50">Waiting for the host…</p>
            )}
          </div>
          {player.isHost && (
            <button
              onClick={handlePlayAgain}
              disabled={startingRound}
              className="shrink-0 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background shadow-sm transition-opacity disabled:opacity-50"
            >
              {startingRound ? "Starting…" : isSolo ? "Next level" : "Play again"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function WordSlots({
  wordLengths,
  found,
  players,
  showNames,
  colorById,
}: {
  wordLengths: number[];
  found: WendFoundWord[];
  players: PlayerInfo[];
  showNames: boolean;
  colorById: Map<string, string>;
}) {
  const sortedFound = [...found].sort((a, b) => a.word.length - b.word.length);

  // Remaining lengths = the round's word lengths minus one entry per found
  // word's own length (not just a count-based slice, which breaks if a
  // longer word is found before a shorter one).
  const lengthCounts = new Map<number, number>();
  for (const len of wordLengths) lengthCounts.set(len, (lengthCounts.get(len) ?? 0) + 1);
  for (const f of found) {
    const remaining = lengthCounts.get(f.word.length) ?? 0;
    if (remaining > 0) lengthCounts.set(f.word.length, remaining - 1);
  }
  const remainingLengths: number[] = [];
  for (const [len, count] of lengthCounts) {
    for (let i = 0; i < count; i++) remainingLengths.push(len);
  }
  remainingLengths.sort((a, b) => a - b);

  function nameFor(playerId: string) {
    return players.find((p) => p.id === playerId)?.name ?? "?";
  }

  return (
    <div className="flex w-full flex-col items-start gap-1.5">
      {sortedFound.map((f) => {
        const color = colorById.get(f.id) ?? "#3b82f6";
        return (
          <div key={f.id} className="flex items-center gap-2">
            <div className="flex gap-1">
              {f.word.split("").map((ch, i) => (
                <span
                  key={i}
                  style={{ backgroundColor: color }}
                  className="flex h-6 w-6 items-center justify-center rounded text-xs font-bold uppercase text-white"
                >
                  {ch}
                </span>
              ))}
            </div>
            {showNames && (
              <span className="text-[11px] text-foreground/50">{nameFor(f.playerId)}</span>
            )}
          </div>
        );
      })}
      {remainingLengths.map((len, i) => (
        <div key={`blank-${i}`} className="flex gap-1">
          {Array.from({ length: len }).map((_, j) => (
            <span
              key={j}
              className="h-6 w-6 rounded border border-dashed border-foreground/15"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-4 text-foreground">
      {children}
    </div>
  );
}
