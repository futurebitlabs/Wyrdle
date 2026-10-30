export type LetterStatus = "correct" | "present" | "absent";

export type GuessResult = LetterStatus[];

export function evaluateGuess(guess: string, answer: string): GuessResult {
  const result: LetterStatus[] = new Array(answer.length).fill("absent");
  const answerLetters = answer.split("");
  const remaining: Record<string, number> = {};

  for (let i = 0; i < answerLetters.length; i++) {
    if (guess[i] === answerLetters[i]) {
      result[i] = "correct";
    } else {
      const letter = answerLetters[i];
      remaining[letter] = (remaining[letter] ?? 0) + 1;
    }
  }

  for (let i = 0; i < guess.length; i++) {
    if (result[i] === "correct") continue;
    const letter = guess[i];
    if (remaining[letter] > 0) {
      result[i] = "present";
      remaining[letter] -= 1;
    }
  }

  return result;
}

export function isWinningResult(result: GuessResult): boolean {
  return result.every((status) => status === "correct");
}
