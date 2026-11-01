import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createRound } from "@/lib/supabase/rounds";
import { createWendRound } from "@/lib/supabase/wendRounds";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/rooms/[code]/rounds">,
) {
  const { code } = await params;
  const body = await request.json().catch(() => null);
  const playerId = typeof body?.playerId === "string" ? body.playerId : null;
  const level =
    typeof body?.level === "number" && Number.isFinite(body.level) ? body.level : null;

  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, game_type")
    .eq("code", code.toUpperCase())
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id, is_host")
    .eq("id", playerId)
    .eq("room_id", room.id)
    .maybeSingle();

  if (playerError || !player) {
    return NextResponse.json({ error: "Player not found in room" }, { status: 404 });
  }

  if (!player.is_host) {
    return NextResponse.json({ error: "Only the host can start a new round" }, { status: 403 });
  }

  const stateTable = room.game_type === "wend" ? "wend_state" : "round_state";

  const { data: active } = await supabase
    .from(stateTable)
    .select("round_id")
    .eq("room_id", room.id)
    .eq("status", "active")
    .maybeSingle();

  if (active) {
    return NextResponse.json({ error: "Round already in progress" }, { status: 409 });
  }

  const { data: latest } = await supabase
    .from(stateTable)
    .select("round_number")
    .eq("room_id", room.id)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextRoundNumber = (latest?.round_number ?? 0) + 1;

  try {
    const round =
      room.game_type === "wend"
        ? await createWendRound(supabase, room.id, nextRoundNumber, level)
        : await createRound(supabase, room.id, nextRoundNumber);
    return NextResponse.json({ round });
  } catch (err) {
    console.error("Failed to create round", err);
    return NextResponse.json({ error: "Could not start new round" }, { status: 500 });
  }
}
