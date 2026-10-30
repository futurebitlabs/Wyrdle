import type { GuessRow } from "@/lib/types";
import type { LetterStatus } from "@/lib/wordle";

const STATUS_CLASSES: Record<LetterStatus, string> = {
  correct: "bg-emerald-600 text-white border-emerald-600",
  present: "bg-amber-500 text-white border-amber-500",
  absent: "bg-foreground/20 text-foreground border-foreground/20",
};

interface GameBoardProps {
  wordLength: number;
  maxGuesses: number;
  guesses: GuessRow[];
  currentGuess: string;
  isGameOver: boolean;
}

export function GameBoard({
  wordLength,
  maxGuesses,
  guesses,
  currentGuess,
  isGameOver,
}: GameBoardProps) {
  const rows = [];

  for (let r = 0; r < maxGuesses; r++) {
    const submitted = guesses[r];
    const isCurrentRow = !submitted && r === guesses.length && !isGameOver;

    const cells = [];
    for (let c = 0; c < wordLength; c++) {
      if (submitted) {
        const letter = submitted.guess[c]?.toUpperCase() ?? "";
        const status = submitted.result[c];
        cells.push(
          <div
            key={c}
            className={`flex h-12 w-12 items-center justify-center rounded border-2 text-xl font-bold uppercase ${STATUS_CLASSES[status]}`}
          >
            {letter}
          </div>,
        );
      } else if (isCurrentRow) {
        const letter = currentGuess[c]?.toUpperCase() ?? "";
        cells.push(
          <div
            key={c}
            className="flex h-12 w-12 items-center justify-center rounded border-2 border-foreground/30 text-xl font-bold uppercase text-foreground"
          >
            {letter}
          </div>,
        );
      } else {
        cells.push(
          <div
            key={c}
            className="flex h-12 w-12 items-center justify-center rounded border-2 border-foreground/10"
          />,
        );
      }
    }

    rows.push(
      <div key={r} className="flex gap-1.5">
        {cells}
      </div>,
    );
  }

  return <div className="flex flex-col gap-1.5">{rows}</div>;
}
