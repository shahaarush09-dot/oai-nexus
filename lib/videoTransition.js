// Timing and stagger helpers for the "Aperture Reveal" video transition — a
// grid of cells dissolves outward from the click origin to reveal the video
// underneath, then reverses (re-covers) on exit.

export const REVEAL_GRID_COLS = 12;
export const REVEAL_GRID_ROWS = 7;
export const CELL_DISSOLVE_DURATION = 0.5;
export const REVEAL_STAGGER_SPAN = 0.6; // seconds the wave takes to cross the grid
export const TOTAL_REVEAL_MS = (REVEAL_STAGGER_SPAN + CELL_DISSOLVE_DURATION) * 1000;
export const EXIT_FLASH_DURATION_MS = 400;
export const MOBILE_REVEAL_MS = 450;

// Distance of (row, col) from the origin cell, normalized against the
// grid's farthest corner — used as each cell's animation delay so the
// dissolve reads as a wave radiating outward from where the user clicked.
export function radialDelay(row, col, originRow, originCol, rows, cols) {
  const dRow = row - originRow;
  const dCol = col - originCol;
  const dist = Math.sqrt(dRow * dRow + dCol * dCol);
  const maxDist = Math.sqrt(
    Math.max(originRow, rows - 1 - originRow) ** 2 +
      Math.max(originCol, cols - 1 - originCol) ** 2
  );
  return maxDist === 0 ? 0 : (dist / maxDist) * REVEAL_STAGGER_SPAN;
}
