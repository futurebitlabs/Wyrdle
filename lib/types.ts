import type { GuessResult } from "./wordle";

export interface RoomInfo {
  id: string;
  code: string;
  wordLength: number;
  maxGuesses: number;
}

export interface PlayerInfo {
  id: string;
  name: string;
  isHost: boolean;
}

export type RoundStatus = "active" | "finished";

export interface RoundInfo {
  roundId: string;
  roomId: string;
  roundNumber: number;
  status: RoundStatus;
  winnerPlayerId: string | null;
  word: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface GuessRow {
  id: string;
  roundId: string;
  playerId: string;
  attemptNumber: number;
  guess: string;
  result: GuessResult;
  isCorrect: boolean;
  createdAt: string;
}
