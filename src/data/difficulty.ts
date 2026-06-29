export type Difficulty = "easy" | "normal" | "hard";
let _difficulty: Difficulty = "normal";
export const getDifficulty = () => _difficulty;
export const setDifficulty = (d: Difficulty) => { _difficulty = d; };
