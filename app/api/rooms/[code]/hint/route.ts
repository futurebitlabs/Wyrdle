import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/hint">,
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
    .select("id")
    .eq("code", code.toUpperCase())
    .single();

  if (roomError || !room) {
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
    .from("round_state")
    .select("round_id")
    .eq("room_id", room.id)
    .eq("status", "active")
    .maybeSingle();

  if (!activeState) {
    return NextResponse.json({ error: "Round already finished" }, { status: 409 });
  }

  const roundId = activeState.round_id as string;

  const { data: existingHint } = await supabase
    .from("hints")
    .select("position, letter")
    .eq("round_id", roundId)
    .eq("player_id", playerId)
    .maybeSingle();

  if (existingHint) {
    return NextResponse.json({ hint: existingHint });
  }

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .select("word")
    .eq("id", roundId)
    .single();

  if (roundError || !round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  const position = Math.floor(Math.random() * round.word.length);
  const letter = round.word[position];

  const { data: inserted, error: insertError } = await supabase
    .from("hints")
    .insert({ round_id: roundId, player_id: playerId, position, letter })
    .select("position, letter")
    .single();

  if (insertError || !inserted) {
    console.error("Failed to create hint", insertError);
    return NextResponse.json({ error: "Could not get hint" }, { status: 500 });
  }

  return NextResponse.json({ hint: inserted });
}
