import type { LetterStatus } from "@/lib/wordle";

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

const STATUS_CLASSES: Record<LetterStatus, string> = {
  correct: "bg-emerald-600 text-white",
  present: "bg-amber-500 text-white",
  absent: "bg-foreground/20 text-foreground/50",
};

interface KeyboardProps {
  letterStatuses: Record<string, LetterStatus>;
  onKey: (key: string) => void;
  disabled: boolean;
}

export function Keyboard({ letterStatuses, onKey, disabled }: KeyboardProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-1.5 px-1">
      {ROWS.map((row, i) => (
        <div key={i} className="flex justify-center gap-1">
          {i === 2 && (
            <button
              onClick={() => onKey("Enter")}
              disabled={disabled}
              className="h-14 flex-[1.6] rounded bg-foreground/10 text-xs font-semibold uppercase text-foreground active:bg-foreground/20 disabled:opacity-50"
            >
              Enter
            </button>
          )}
          {row.split("").map((letter) => (
            <button
              key={letter}
              onClick={() => onKey(letter)}
              disabled={disabled}
              className={`h-14 flex-1 rounded text-base font-semibold uppercase active:brightness-110 disabled:opacity-50 ${
                letterStatuses[letter]
                  ? STATUS_CLASSES[letterStatuses[letter]]
                  : "bg-foreground/10 text-foreground"
              }`}
            >
              {letter}
            </button>
          ))}
          {i === 2 && (
            <button
              onClick={() => onKey("Backspace")}
              disabled={disabled}
              className="h-14 flex-[1.6] rounded bg-foreground/10 text-base text-foreground active:bg-foreground/20 disabled:opacity-50"
            >
              ⌫
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
