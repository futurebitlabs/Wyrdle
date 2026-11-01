"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { loadPlayer, savePlayer } from "@/lib/storage";
import { postJson } from "@/lib/postJson";
import type { GuessRow, PlayerInfo, RoomInfo, RoundInfo, RoundStatus } from "@/lib/types";
import type { LetterStatus } from "@/lib/wordle";
import { GameBoard } from "./GameBoard";
import { Keyboard } from "./Keyboard";
import { Leaderboard } from "./Leaderboard";
import { HomeButton } from "./HomeButton";

type Status = "loading" | "needs-name" | "ready" | "not-found" | "error";

interface PlayerRow {
  id: string;
  name: string;
  is_host: boolean;
}

interface GuessDbRow {
  id: string;
  round_id: string;
  player_id: string;
  attempt_number: number;
  guess: string;
  result: LetterStatus[];
  is_correct: boolean;
  created_at: string;
}

interface RoundStateRow {
  round_id: string;
  room_id: string;
  round_number: number;
  status: RoundStatus;
  winner_player_id: string | null;
  word: string | null;
  started_at: string;
  finished_at: string | null;
}

function toPlayerInfo(row: PlayerRow): PlayerInfo {
  return { id: row.id, name: row.name, isHost: row.is_host };
}

function toGuessRow(row: GuessDbRow): GuessRow {
  return {
    id: row.id,
    roundId: row.round_id,
    playerId: row.player_id,
    attemptNumber: row.attempt_number,
    guess: row.guess,
    result: row.result,
    isCorrect: row.is_correct,
    createdAt: row.created_at,
  };
}

function toRoundInfo(row: RoundStateRow): RoundInfo {
  return {
    roundId: row.round_id,
    roomId: row.room_id,
    roundNumber: row.round_number,
    status: row.status,
    winnerPlayerId: row.winner_player_id,
    word: row.word,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

const STATUS_RANK: Record<LetterStatus, number> = { absent: 0, present: 1, correct: 2 };

export function RoomClient({ code, solo = false }: { code: string; solo?: boolean }) {
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [rounds, setRounds] = useState<RoundInfo[]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [banner, setBanner] = useState<string | null>(null);
  const [startingRound, setStartingRound] = useState(false);
  const [hint, setHint] = useState<{ position: number; letter: string } | null>(null);
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
      const [playersRes, guessesRes, roundsRes] = await Promise.all([
        supabase.from("players").select("id, name, is_host").eq("room_id", room!.id),
        supabase
          .from("guesses")
          .select("id, round_id, player_id, attempt_number, guess, result, is_correct, created_at")
          .eq("room_id", room!.id)
          .order("attempt_number", { ascending: true }),
        supabase
          .from("round_state")
          .select("*")
          .eq("room_id", room!.id)
          .order("round_number", { ascending: true }),
      ]);
      if (cancelled) return;
      if (playersRes.data) {
        setPlayers((playersRes.data as PlayerRow[]).map(toPlayerInfo));
      }
      if (guessesRes.data) {
        setGuesses((guessesRes.data as GuessDbRow[]).map(toGuessRow));
      }
      if (roundsRes.data) {
        setRounds((roundsRes.data as RoundStateRow[]).map(toRoundInfo));
      }
    }

    loadInitialState();

    const channel = supabase
      .channel(`room:${room.id}`)
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
        { event: "INSERT", schema: "public", table: "guesses", filter: `room_id=eq.${room.id}` },
        (payload) => {
          const row = toGuessRow(payload.new as GuessDbRow);
          setGuesses((prev) => (prev.some((g) => g.id === row.id) ? prev : [...prev, row]));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "round_state", filter: `room_id=eq.${room.id}` },
        (payload) => {
          const row = toRoundInfo(payload.new as RoundStateRow);
          setRounds((prev) => (prev.some((r) => r.roundId === row.roundId) ? prev : [...prev, row]));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "round_state", filter: `room_id=eq.${room.id}` },
        (payload) => {
          const row = toRoundInfo(payload.new as RoundStateRow);
          setRounds((prev) => prev.map((r) => (r.roundId === row.roundId ? row : r)));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [room]);

  const currentRound = useMemo(
    () => rounds.reduce<RoundInfo | null>((latest, r) => (!latest || r.roundNumber > latest.roundNumber ? r : latest), null),
    [rounds],
  );

  const [guessRoundId, setGuessRoundId] = useState<string | undefined>(currentRound?.roundId);
  if (currentRound?.roundId !== guessRoundId) {
    setGuessRoundId(currentRound?.roundId);
    setCurrentGuess("");
    setHint(null);
  }

  const myGuesses = useMemo(
    () =>
      guesses
        .filter((g) => g.roundId === currentRound?.roundId && g.playerId === player?.id)
        .sort((a, b) => a.attemptNumber - b.attemptNumber),
    [guesses, player, currentRound],
  );

  const currentRoundGuesses = useMemo(
    () => guesses.filter((g) => g.roundId === currentRound?.roundId),
    [guesses, currentRound],
  );

  const guessesByPlayer = useMemo(() => {
    const map = new Map<string, GuessRow[]>();
    for (const g of currentRoundGuesses) {
      const list = map.get(g.playerId) ?? [];
      list.push(g);
      map.set(g.playerId, list);
    }
    return map;
  }, [currentRoundGuesses]);

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

  const letterStatuses = useMemo(() => {
    const map: Record<string, LetterStatus> = {};
    for (const g of myGuesses) {
      for (let i = 0; i < g.guess.length; i++) {
        const letter = g.guess[i];
        const status = g.result[i];
        if (!map[letter] || STATUS_RANK[status] > STATUS_RANK[map[letter]]) {
          map[letter] = status;
        }
      }
    }
    if (hint) {
      map[hint.letter] = "correct";
    }
    return map;
  }, [myGuesses, hint]);

  const getHint = useCallback(async () => {
    if (!player || isGameOver || hint || hintPending) return;
    setHintPending(true);
    try {
      const data = await postJson<{ hint: { position: number; letter: string } }>(
        `/api/rooms/${code}/hint`,
        { playerId: player.id },
      );
      setHint(data.hint);
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Could not get hint");
      setTimeout(() => setBanner(null), 2000);
    } finally {
      setHintPending(false);
    }
  }, [player, code, isGameOver, hint, hintPending]);

  const submitGuess = useCallback(async () => {
    if (!room || !player || !currentRound || isGameOver) return;
    if (currentGuess.length !== room.wordLength) {
      setBanner(`Guess must be ${room.wordLength} letters`);
      setTimeout(() => setBanner(null), 2000);
      return;
    }
    try {
      const data = await postJson<{ guess: GuessRow }>(`/api/rooms/${code}/guess`, {
        playerId: player.id,
        guess: currentGuess,
      });
      setGuesses((prev) =>
        prev.some((g) => g.id === data.guess.id) ? prev : [...prev, data.guess],
      );
      setCurrentGuess("");
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Could not submit guess");
      setTimeout(() => setBanner(null), 2000);
    }
  }, [room, player, code, currentGuess, currentRound, isGameOver]);

  const handleKey = useCallback(
    (key: string) => {
      if (isGameOver || !room) return;
      if (key === "Enter") {
        submitGuess();
      } else if (key === "Backspace") {
        setCurrentGuess((prev) => prev.slice(0, -1));
      } else if (/^[a-z]$/i.test(key) && currentGuess.length < room.wordLength) {
        setCurrentGuess((prev) => prev + key.toLowerCase());
      }
    },
    [isGameOver, room, currentGuess, submitGuess],
  );

  useEffect(() => {
    if (status !== "ready") return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      handleKey(e.key);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, handleKey]);

  async function handlePlayAgain() {
    if (!player) return;
    setStartingRound(true);
    try {
      await postJson(`/api/rooms/${code}/rounds`, { playerId: player.id });
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Could not start new round");
      setTimeout(() => setBanner(null), 2000);
    } finally {
      setStartingRound(false);
    }
  }

  if (status === "loading") {
    return <Centered>Loading…</Centered>;
  }

  if (status === "not-found") {
    return <Centered>{errorMessage ?? `Game ${code} not found.`}</Centered>;
  }

  if (status === "needs-name") {
    return (
      <Centered>
        <form onSubmit={handleNameSubmit} className="w-full max-w-xs space-y-3">
          <h1 className="text-center text-2xl font-bold text-foreground">
            Join game {code}
          </h1>
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

  if (!room || !player) return <Centered>Something went wrong.</Centered>;

  return (
    <div className="flex flex-1 flex-col items-center gap-6 bg-background px-4 py-8">
      {banner && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <p className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">
            {banner}
          </p>
        </div>
      )}

      <div className="flex w-full justify-start">
        <HomeButton />
      </div>

      <div className="text-center">
        <p className="text-xs uppercase tracking-wide text-foreground/50">
          {isSolo ? "Playing solo · " : "Game key · "}Round {currentRound?.roundNumber ?? 1}
        </p>
        <p className="font-mono text-2xl font-bold tracking-widest text-foreground">
          {room.code}
        </p>
        {isSolo && (
          <p className="mt-1 text-xs text-foreground/40">Share this key to invite others</p>
        )}
      </div>

      {isGameOver && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-foreground/10 px-6 py-4 text-center">
          <p className="text-sm text-foreground/80">
            {isSolo ? (
              winner ? "You solved it!" : "Out of guesses."
            ) : winner ? (
              <>
                <span className="font-semibold">{winner.name}</span> won this round!
              </>
            ) : (
              "Nobody solved it this round."
            )}
            {currentRound?.word && (
              <>
                {" "}
                The word was{" "}
                <span className="font-semibold uppercase">{currentRound.word}</span>.
              </>
            )}
          </p>
          {player.isHost ? (
            <button
              onClick={handlePlayAgain}
              disabled={startingRound}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {startingRound ? "Starting…" : "Play again"}
            </button>
          ) : (
            <p className="text-xs text-foreground/50">Waiting for the host to start the next round…</p>
          )}
        </div>
      )}

      <div className="flex w-full flex-col items-center gap-6 md:flex-row md:items-start md:justify-center">
        <div className="flex w-full flex-col items-center gap-6">
          <GameBoard
            wordLength={room.wordLength}
            maxGuesses={room.maxGuesses}
            guesses={myGuesses}
            currentGuess={currentGuess}
            isGameOver={isGameOver}
          />

          {!isGameOver &&
            (hint ? (
              <p className="text-sm text-foreground/70">
                Hint: letter {hint.position + 1} is{" "}
                <span className="font-semibold uppercase">{hint.letter}</span>
              </p>
            ) : (
              <button
                onClick={getHint}
                disabled={hintPending}
                className="rounded-full border border-foreground/20 px-4 py-1.5 text-sm font-medium text-foreground disabled:opacity-50"
              >
                {hintPending ? "Getting hint…" : "Get a hint"}
              </button>
            ))}

          <Keyboard letterStatuses={letterStatuses} onKey={handleKey} disabled={isGameOver} />
        </div>

        {!isSolo && (
          <Leaderboard
            players={players}
            guessesByPlayer={guessesByPlayer}
            winsByPlayer={winsByPlayer}
            maxGuesses={room.maxGuesses}
            localPlayerId={player.id}
          />
        )}
      </div>
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
