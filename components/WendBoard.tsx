"use client";

import { useRef, useState } from "react";
import type { WendCell } from "@/lib/wend/generate";

export interface WendFoundPath {
  path: [number, number][];
  color: string;
}

interface WendBoardProps {
  cells: WendCell[][];
  gridSize: number;
  lockedCells: Set<string>;
  foundPaths: WendFoundPath[];
  hintCell: [number, number] | null;
  disabled: boolean;
  onSubmit: (path: [number, number][]) => void;
}

const DRAG_COLOR = "#f59e0b";

function key(r: number, c: number) {
  return `${r},${c}`;
}

function isAdjacent(a: [number, number], b: [number, number]) {
  const dr = Math.abs(a[0] - b[0]);
  const dc = Math.abs(a[1] - b[1]);
  return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
}

function cellCenter(gridSize: number, [r, c]: [number, number]): string {
  const unit = 100 / gridSize;
  return `${(c + 0.5) * unit},${(r + 0.5) * unit}`;
}

export function WendBoard({
  cells,
  gridSize,
  lockedCells,
  foundPaths,
  hintCell,
  disabled,
  onSubmit,
}: WendBoardProps) {
  const [path, setPath] = useState<[number, number][]>([]);
  const draggingRef = useRef(false);

  function tileAt(clientX: number, clientY: number): [number, number] | null {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const tile = el?.closest<HTMLElement>("[data-row]");
    if (!tile) return null;
    const r = Number(tile.dataset.row);
    const c = Number(tile.dataset.col);
    if (Number.isNaN(r) || Number.isNaN(c)) return null;
    return [r, c];
  }

  function startAt(r: number, c: number) {
    if (disabled || cells[r][c] === null || lockedCells.has(key(r, c))) return;
    draggingRef.current = true;
    setPath([[r, c]]);
  }

  function extendTo(r: number, c: number) {
    if (!draggingRef.current) return;
    setPath((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last[0] === r && last[1] === c) return prev;

      if (prev.length >= 2) {
        const prevLast = prev[prev.length - 2];
        if (prevLast[0] === r && prevLast[1] === c) {
          return prev.slice(0, -1);
        }
      }

      if (cells[r][c] === null || lockedCells.has(key(r, c))) return prev;
      if (prev.some(([pr, pc]) => pr === r && pc === c)) return prev;
      if (!isAdjacent(last, [r, c])) return prev;

      return [...prev, [r, c]];
    });
  }

  function finish() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setPath((prev) => {
      if (prev.length >= 2) {
        onSubmit(prev);
      }
      return [];
    });
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, r: number, c: number) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    startAt(r, c);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    const tile = tileAt(e.clientX, e.clientY);
    if (tile) extendTo(tile[0], tile[1]);
  }

  function handlePointerUp() {
    finish();
  }

  const pathKeys = new Set(path.map(([r, c]) => key(r, c)));
  const tubeWidth = Math.max(100 / gridSize - 5, 6);

  return (
    <div
      className="relative w-full touch-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={(e) => {
        if (e.buttons === 0) handlePointerUp();
      }}
    >
      <svg
        viewBox="0 0 100 100"
        className="pointer-events-none absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
      >
        {foundPaths.map(({ path: p, color }, i) => (
          <polyline
            key={i}
            points={p.map((cell) => cellCenter(gridSize, cell)).join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={tubeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {path.length > 1 && (
          <polyline
            points={path.map((cell) => cellCenter(gridSize, cell)).join(" ")}
            fill="none"
            stroke={DRAG_COLOR}
            strokeWidth={tubeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>

      <div
        className="relative grid w-full gap-1.5"
        style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
      >
        {cells.map((row, r) =>
          row.map((letter, c) => {
            const isBlocked = letter === null;
            const isLocked = lockedCells.has(key(r, c));
            const isSelected = pathKeys.has(key(r, c));
            const isHinted = hintCell?.[0] === r && hintCell?.[1] === c;
            const onPath = isLocked || isSelected;

            return (
              <div
                key={key(r, c)}
                data-row={isBlocked ? undefined : r}
                data-col={isBlocked ? undefined : c}
                onPointerDown={isBlocked ? undefined : (e) => handlePointerDown(e, r, c)}
                className={`flex aspect-square select-none items-center justify-center rounded-md text-lg font-bold uppercase ${
                  isBlocked
                    ? "bg-foreground/15"
                    : isHinted && !onPath
                      ? "cursor-pointer bg-amber-500/20 text-foreground ring-2 ring-amber-500"
                      : !onPath
                        ? "cursor-pointer bg-foreground/10 text-foreground active:bg-foreground/20"
                        : ""
                }`}
              >
                {!isBlocked && onPath && (
                  <span className="flex h-[72%] w-[72%] items-center justify-center rounded-full bg-white text-black shadow-sm">
                    {letter}
                  </span>
                )}
                {!isBlocked && !onPath && letter}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
