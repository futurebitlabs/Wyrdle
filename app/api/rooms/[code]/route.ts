import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/rooms/[code]">,
) {
  const { code } = await params;
  const supabase = createServiceClient();

  const { data: room, error } = await supabase
    .from("rooms")
    .select("id, code, word_length, max_guesses")
    .eq("code", code.toUpperCase())
    .single();

  if (error || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json({
    room: {
      id: room.id,
      code: room.code,
      wordLength: room.word_length,
      maxGuesses: room.max_guesses,
    },
  });
}
