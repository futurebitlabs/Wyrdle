import type { GuessResult } from "./wordle";
import type { WendCell } from "./wend/generate";

export type GameType = "wyrdle" | "wend";

export interface RoomInfo {
  id: string;
  code: string;
  gameType: GameType;
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

export interface WendRoundInfo {
  roundId: string;
  roomId: string;
  roundNumber: number;
  levelNumber: number;
  status: RoundStatus;
  gridSize: number;
  cells: WendCell[][];
  wordLengths: number[];
  words: string[] | null;
  winnerPlayerId: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface WendFoundWord {
  id: string;
  roundId: string;
  playerId: string;
  word: string;
  path: [number, number][];
  foundAt: string;
}
