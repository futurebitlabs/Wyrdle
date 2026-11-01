import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/wend/undo">,
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

  const { data: lastFound } = await supabase
    .from("wend_found_words")
    .select("id, word")
    .eq("round_id", roundId)
    .eq("player_id", playerId)
    .order("found_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastFound) {
    return NextResponse.json({ error: "Nothing to undo" }, { status: 409 });
  }

  const { error: deleteError } = await supabase
    .from("wend_found_words")
    .delete()
    .eq("id", lastFound.id);

  if (deleteError) {
    console.error("Failed to undo found word", deleteError);
    return NextResponse.json({ error: "Could not undo" }, { status: 500 });
  }

  return NextResponse.json({ removed: lastFound.word });
}
