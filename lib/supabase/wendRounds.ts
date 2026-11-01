import type { SupabaseClient } from "@supabase/supabase-js";
import { generateWendPuzzle } from "@/lib/wend/generate";
import { getWendLevel, WEND_MULTIPLAYER_LEVEL } from "@/lib/wend/levels";

export async function createWendRound(
  supabase: SupabaseClient,
  roomId: string,
  roundNumber: number,
  levelNumber: number | null,
) {
  const resolvedLevelNumber = levelNumber ?? WEND_MULTIPLAYER_LEVEL;
  const level = getWendLevel(resolvedLevelNumber);
  const puzzle = generateWendPuzzle(level);

  const { data: round, error: roundError } = await supabase
    .from("wend_puzzles")
    .insert({
      room_id: roomId,
      round_number: roundNumber,
      level_number: resolvedLevelNumber,
      grid_size: puzzle.gridSize,
      cells: puzzle.cells,
      words: puzzle.words,
    })
    .select("id")
    .single();

  if (roundError || !round) {
    throw new Error(roundError?.message ?? "Could not create Wend round");
  }

  const { error: stateError } = await supabase.from("wend_state").insert({
    round_id: round.id,
    room_id: roomId,
    round_number: roundNumber,
    level_number: resolvedLevelNumber,
    grid_size: puzzle.gridSize,
    cells: puzzle.cells,
    word_lengths: puzzle.words.map((w) => w.word.length),
  });

  if (stateError) {
    throw new Error(stateError.message);
  }

  return { roundId: round.id as string, roundNumber, levelNumber: resolvedLevelNumber };
}
