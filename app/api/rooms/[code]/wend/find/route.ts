import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isValidPath } from "@/lib/wend/validate";
import type { WendCell } from "@/lib/wend/generate";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/wend/find">,
) {
  const { code } = await params;
  const body = await request.json().catch(() => null);
  const playerId = typeof body?.playerId === "string" ? body.playerId : null;
  const path = body?.path;

  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }
  if (!isValidPath(path)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, game_type")
    .eq("code", code.toUpperCase())
    .single();

  if (roomError || !room || room.game_type !== "wend") {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const [{ data: player, error: playerError }, { data: activeState }] = await Promise.all([
    supabase.from("players").select("id").eq("id", playerId).eq("room_id", room.id).maybeSingle(),
    supabase
      .from("wend_state")
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

  const { data: puzzle, error: puzzleError } = await supabase
    .from("wend_puzzles")
    .select("grid_size, cells, words")
    .eq("id", roundId)
    .single();

  if (puzzleError || !puzzle) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  const cells = puzzle.cells as WendCell[][];
  const targetWords = (puzzle.words as { word: string }[]).map((w) => w.word);

  for (const [r, c] of path as [number, number][]) {
    if (r < 0 || r >= puzzle.grid_size || c < 0 || c >= puzzle.grid_size || cells[r][c] === null) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }
  }

  const traced = (path as [number, number][]).map(([r, c]) => cells[r][c]).join("").toLowerCase();

  if (!targetWords.includes(traced)) {
    return NextResponse.json({ error: "Not one of the hidden words" }, { status: 400 });
  }

  const { error: insertError } = await supabase.from("wend_found_words").insert({
    round_id: roundId,
    room_id: room.id,
    player_id: playerId,
    word: traced,
    path,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "Already found" }, { status: 409 });
    }
    console.error("Failed to insert found word", insertError);
    return NextResponse.json({ error: "Could not submit word" }, { status: 500 });
  }

  const { data: foundSoFar } = await supabase
    .from("wend_found_words")
    .select("player_id, found_at")
    .eq("round_id", roundId);

  let roundFinished = false;

  if ((foundSoFar?.length ?? 0) >= targetWords.length) {
    const tally = new Map<string, { count: number; lastFoundAt: string }>();
    for (const row of foundSoFar ?? []) {
      const entry = tally.get(row.player_id) ?? { count: 0, lastFoundAt: row.found_at };
      entry.count += 1;
      if (row.found_at > entry.lastFoundAt) entry.lastFoundAt = row.found_at;
      tally.set(row.player_id, entry);
    }
    let winnerId: string | null = null;
    let best: { count: number; lastFoundAt: string } | null = null;
    for (const [pid, entry] of tally) {
      if (
        !best ||
        entry.count > best.count ||
        (entry.count === best.count && entry.lastFoundAt < best.lastFoundAt)
      ) {
        best = entry;
        winnerId = pid;
      }
    }

    const { data: claimed } = await supabase
      .from("wend_state")
      .update({
        status: "finished",
        winner_player_id: winnerId,
        words: targetWords,
        finished_at: new Date().toISOString(),
      })
      .eq("round_id", roundId)
      .eq("status", "active")
      .select("round_id")
      .maybeSingle();

    roundFinished = Boolean(claimed);
  }

  return NextResponse.json({
    found: { word: traced, path },
    roundFinished,
  });
}
