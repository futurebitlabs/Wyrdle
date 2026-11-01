import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createRound } from "@/lib/supabase/rounds";
import { createWendRound } from "@/lib/supabase/wendRounds";
import { generateRoomCode } from "@/lib/roomCode";

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
const MAX_CODE_ATTEMPTS = 5;

type GameType = "wyrdle" | "wend";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 24) : "";
  const gameType: GameType = body?.gameType === "wend" ? "wend" : "wyrdle";
  const level =
    typeof body?.level === "number" && Number.isFinite(body.level) ? body.level : null;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  let room: {
    id: string;
    code: string;
    game_type: GameType;
    word_length: number;
    max_guesses: number;
  } | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    const { data, error } = await supabase
      .from("rooms")
      .insert({ code, game_type: gameType, word_length: WORD_LENGTH, max_guesses: MAX_GUESSES })
      .select("id, code, game_type, word_length, max_guesses")
      .single();

    if (!error) {
      room = data;
      break;
    }
    lastError = error;
  }

  if (!room) {
    console.error("Failed to create room", lastError);
    return NextResponse.json({ error: "Could not create room" }, { status: 500 });
  }

  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert({ room_id: room.id, name, is_host: true })
    .select("id, name, is_host")
    .single();

  if (playerError || !player) {
    console.error("Failed to create host player", playerError);
    return NextResponse.json({ error: "Could not join room" }, { status: 500 });
  }

  try {
    if (gameType === "wend") {
      await createWendRound(supabase, room.id, 1, level);
    } else {
      await createRound(supabase, room.id, 1);
    }
  } catch (err) {
    console.error("Failed to create first round", err);
    return NextResponse.json({ error: "Could not start game" }, { status: 500 });
  }

  return NextResponse.json({
    room: {
      id: room.id,
      code: room.code,
      gameType: room.game_type,
      wordLength: room.word_length,
      maxGuesses: room.max_guesses,
    },
    player: { id: player.id, name: player.name, isHost: player.is_host },
  });
}
