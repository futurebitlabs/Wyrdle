import type { SupabaseClient } from "@supabase/supabase-js";
import { WORDS } from "@/lib/words";

export async function createRound(
  supabase: SupabaseClient,
  roomId: string,
  roundNumber: number,
) {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .insert({ room_id: roomId, round_number: roundNumber, word })
    .select("id")
    .single();

  if (roundError || !round) {
    throw new Error(roundError?.message ?? "Could not create round");
  }

  const { error: stateError } = await supabase.from("round_state").insert({
    round_id: round.id,
    room_id: roomId,
    round_number: roundNumber,
  });

  if (stateError) {
    throw new Error(stateError.message);
  }

  return { roundId: round.id as string, roundNumber };
}
