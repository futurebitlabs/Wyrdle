import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/join">,
) {
  const { code } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 24) : "";
  const existingPlayerId =
    typeof body?.playerId === "string" ? body.playerId : null;

  const supabase = createServiceClient();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, code, word_length, max_guesses")
    .eq("code", code.toUpperCase())
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const roomInfo = {
    id: room.id,
    code: room.code,
    wordLength: room.word_length,
    maxGuesses: room.max_guesses,
  };

  if (existingPlayerId) {
    const { data: existingPlayer } = await supabase
      .from("players")
      .select("id, name, is_host")
      .eq("id", existingPlayerId)
      .eq("room_id", room.id)
      .maybeSingle();

    if (existingPlayer) {
      return NextResponse.json({
        room: roomInfo,
        player: {
          id: existingPlayer.id,
          name: existingPlayer.name,
          isHost: existingPlayer.is_host,
        },
      });
    }
  }

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert({ room_id: room.id, name, is_host: false })
    .select("id, name, is_host")
    .single();

  if (playerError || !player) {
    console.error("Failed to join room", playerError);
    return NextResponse.json({ error: "Could not join room" }, { status: 500 });
  }

  return NextResponse.json({
    room: roomInfo,
    player: { id: player.id, name: player.name, isHost: player.is_host },
  });
}
