import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { evaluateGuess, isWinningResult } from "@/lib/wordle";
import { WORDS } from "@/lib/words";
import { VALID_GUESSES } from "@/lib/validGuesses";

// Secret words always come from the small curated list in lib/words.ts (so
// answers stay common/guessable), but accepted guesses come from the much
// larger dictionary in lib/validGuesses.ts — otherwise real words outside
// the curated list (e.g. "aisle") get wrongly rejected, and restricting to
// "any letters" instead lets nonsense strings like "asdfg" through.
const DICTIONARY = new Set([...WORDS, ...VALID_GUESSES]);

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/guess">,
) {
  const { code } = await params;
  const body = await request.json().catch(() => null);
  const playerId = typeof body?.playerId === "string" ? body.playerId : null;
  const guess =
    typeof body?.guess === "string" ? body.guess.trim().toLowerCase() : "";

  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, word_length, max_guesses")
    .eq("code", code.toUpperCase())
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (guess.length !== room.word_length) {
    return NextResponse.json(
      { error: `Guess must be ${room.word_length} letters` },
      { status: 400 },
    );
  }

  if (!DICTIONARY.has(guess)) {
    return NextResponse.json({ error: "Not a recognized word" }, { status: 400 });
  }

  // Player membership and the active round are independent of each other —
  // fetch both in one round trip instead of two sequential ones.
  const [{ data: player, error: playerError }, { data: activeState }] = await Promise.all([
    supabase.from("players").select("id").eq("id", playerId).eq("room_id", room.id).maybeSingle(),
    supabase
      .from("round_state")
      .select("round_id")
      .eq("room_id", room.id)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  if (playerError || !player) {
    return NextResponse.json({ error: "Player not found in room" }, { status: 404 });
  }

  if (!activeState) {
    return NextResponse.json({ error: "Round already finished" }, { status: 409 });
  }

  const roundId = activeState.round_id as string;

  // The secret word and this player's previous guesses are independent too.
  const [{ data: round, error: roundError }, { data: previousGuesses, error: previousError }] =
    await Promise.all([
      supabase.from("rounds").select("word").eq("id", roundId).single(),
      supabase
        .from("guesses")
        .select("attempt_number, is_correct")
        .eq("round_id", roundId)
        .eq("player_id", playerId)
        .order("attempt_number", { ascending: false }),
    ]);

  if (roundError || !round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  if (previousError) {
    console.error("Failed to load previous guesses", previousError);
    return NextResponse.json({ error: "Could not submit guess" }, { status: 500 });
  }

  const alreadySolved = previousGuesses?.some((g) => g.is_correct) ?? false;
  const attemptsUsed = previousGuesses?.length ?? 0;

  if (alreadySolved) {
    return NextResponse.json({ error: "You already solved this word" }, { status: 409 });
  }

  if (attemptsUsed >= room.max_guesses) {
    return NextResponse.json({ error: "No guesses remaining" }, { status: 409 });
  }

  const result = evaluateGuess(guess, round.word);
  const isCorrect = isWinningResult(result);
  const attemptNumber = attemptsUsed + 1;

  const { data: inserted, error: insertError } = await supabase
    .from("guesses")
    .insert({
      round_id: roundId,
      room_id: room.id,
      player_id: playerId,
      attempt_number: attemptNumber,
      guess,
      result,
      is_correct: isCorrect,
    })
    .select("id, attempt_number, guess, result, is_correct, created_at")
    .single();

  if (insertError || !inserted) {
    console.error("Failed to insert guess", insertError);
    return NextResponse.json({ error: "Could not submit guess" }, { status: 500 });
  }

  let roundFinished = false;

  if (isCorrect) {
    const { data: claimed } = await supabase
      .from("round_state")
      .update({
        status: "finished",
        winner_player_id: playerId,
        word: round.word,
        finished_at: new Date().toISOString(),
      })
      .eq("round_id", roundId)
      .eq("status", "active")
      .select("round_id")
      .maybeSingle();

    roundFinished = Boolean(claimed);
  } else if (attemptNumber >= room.max_guesses) {
    const [{ data: roomPlayers }, { data: roundGuesses }] = await Promise.all([
      supabase.from("players").select("id").eq("room_id", room.id),
      supabase.from("guesses").select("player_id").eq("round_id", roundId),
    ]);

    const attemptCounts = new Map<string, number>();
    for (const g of roundGuesses ?? []) {
      attemptCounts.set(g.player_id, (attemptCounts.get(g.player_id) ?? 0) + 1);
    }
    const everyoneExhausted = (roomPlayers ?? []).every(
      (p) => (attemptCounts.get(p.id) ?? 0) >= room.max_guesses,
    );

    if (everyoneExhausted) {
      await supabase
        .from("round_state")
        .update({
          status: "finished",
          winner_player_id: null,
          word: round.word,
          finished_at: new Date().toISOString(),
        })
        .eq("round_id", roundId)
        .eq("status", "active");
      roundFinished = true;
    }
  }

  return NextResponse.json({
    guess: {
      id: inserted.id,
      roundId,
      playerId,
      attemptNumber: inserted.attempt_number,
      guess: inserted.guess,
      result: inserted.result,
      isCorrect: inserted.is_correct,
      createdAt: inserted.created_at,
    },
    roundFinished,
  });
}
