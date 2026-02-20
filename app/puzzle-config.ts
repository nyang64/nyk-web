// Puzzle configuration
// Note: Puzzle number is now automatically determined by the user's local date
// (Day 1 = Jan 1, Day 365 = Dec 31)
// This constant is kept for manual override if needed
export const CURRENT_PUZZLE_NUMBER = 1;

// Difficulty level configurations
// allowRotation: false for easier levels (simpler drag-and-drop only)
export const LEVELS = [
  { id: "level-1", label: "Level 1 (Easy)", pieces: 6, gridCols: 3, gridRows: 2, allowRotation: false },
  { id: "level-2", label: "Level 2", pieces: 12, gridCols: 4, gridRows: 3, allowRotation: false },
  { id: "level-3", label: "Level 3", pieces: 24, gridCols: 6, gridRows: 4, allowRotation: false },
  { id: "level-4", label: "Level 4", pieces: 35, gridCols: 7, gridRows: 5, allowRotation: true },
  { id: "level-5", label: "Level 5 (Expert)", pieces: 48, gridCols: 8, gridRows: 6, allowRotation: true },
] as const;

export type LevelId = (typeof LEVELS)[number]["id"];
