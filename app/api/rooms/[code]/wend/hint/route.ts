import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/wend/hint">,
) {
  const { code } = await params;
  const body = await request.json().catch(() => null);
  const playerId = typeof body?.playerId === "string" ? body.playerId : null;

  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
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

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id")
    .eq("id", playerId)
    .eq("room_id", room.id)
    .maybeSingle();

  if (playerError || !player) {
    return NextResponse.json({ error: "Player not found in room" }, { status: 404 });
  }

  const { data: activeState } = await supabase
    .from("wend_state")
    .select("round_id")
    .eq("room_id", room.id)
    .eq("status", "active")
    .maybeSingle();

  if (!activeState) {
    return NextResponse.json({ error: "Round already finished" }, { status: 409 });
  }

  const roundId = activeState.round_id as string;

  const { data: existingHint } = await supabase
    .from("wend_hints")
    .select("row, col")
    .eq("round_id", roundId)
    .eq("player_id", playerId)
    .maybeSingle();

  if (existingHint) {
    return NextResponse.json({ hint: existingHint });
  }

  const [{ data: puzzle, error: puzzleError }, { data: found }] = await Promise.all([
    supabase.from("wend_puzzles").select("words").eq("id", roundId).single(),
    supabase.from("wend_found_words").select("word").eq("round_id", roundId),
  ]);

  if (puzzleError || !puzzle) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  const foundWords = new Set((found ?? []).map((f) => f.word));
  const words = puzzle.words as { word: string; path: [number, number][] }[];
  const unfound = words.filter((w) => !foundWords.has(w.word));

  if (unfound.length === 0) {
    return NextResponse.json({ error: "No words left to hint" }, { status: 409 });
  }

  const target = unfound[Math.floor(Math.random() * unfound.length)];
  const [row, col] = target.path[0];

  const { data: inserted, error: insertError } = await supabase
    .from("wend_hints")
    .insert({ round_id: roundId, player_id: playerId, row, col })
    .select("row, col")
    .single();

  if (insertError || !inserted) {
    console.error("Failed to create wend hint", insertError);
    return NextResponse.json({ error: "Could not get hint" }, { status: 500 });
  }

  return NextResponse.json({ hint: inserted });
}
