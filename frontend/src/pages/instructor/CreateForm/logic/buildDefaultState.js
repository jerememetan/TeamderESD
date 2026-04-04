import { DEFAULT_WEIGHTS } from "./weights";

export function buildDefaultState(group) {
  const preferredGroupSize = 5;
  const numGroups = Math.max(
    1,
    Math.ceil(
      (group?.studentsCount ?? preferredGroupSize) / preferredGroupSize,
    ),
  );
  const minimumGroupSize = Math.max(2, preferredGroupSize - 1);

  return {
    numGroups,
    preferredGroupSize,
    minimumGroupSize,
    mixGender: true,
    mixYear: true,
    allowBuddy: true,
    weights: {
      ...DEFAULT_WEIGHTS,
      gender_weight: DEFAULT_WEIGHTS.gender_weight,
      year_weight: DEFAULT_WEIGHTS.year_weight,
      buddy_weight: DEFAULT_WEIGHTS.buddy_weight,
    },
    topics: [],
    skills: [],
  };
}
