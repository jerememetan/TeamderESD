import { DEFAULT_WEIGHTS } from "./weights";

export function buildDefaultState(group, existingForm) {
  const preferredGroupSize = existingForm?.groupSize ?? 5;
  const numGroups = Math.max(
    1,
    Math.ceil(
      (group?.studentsCount ?? preferredGroupSize) / preferredGroupSize,
    ),
  );
  const minimumGroupSize =
    existingForm?.minimumGroupSize ?? Math.max(2, preferredGroupSize - 1);

  const topicsFromCriteria =
    existingForm?.criteria
      ?.filter(
        (criterion) =>
          criterion.type === "multiple-choice" && criterion.options?.length,
      )
      .flatMap((criterion, criterionIndex) =>
        (criterion.options ?? []).map((option, optionIndex) => ({
          id: `topic-${criterion.id ?? criterionIndex}-${optionIndex}`,
          topic_label: String(option ?? ""),
        })),
      )
      .slice(0, 4) ?? [];

  return {
    numGroups,
    preferredGroupSize,
    minimumGroupSize,
    mixGender: existingForm?.mixGender ?? true,
    mixYear: existingForm?.mixYear ?? true,
    allowBuddy: existingForm?.allowBuddy ?? true,
    weights: {
      ...DEFAULT_WEIGHTS,
      gender_weight:
        existingForm?.mixGender === false ? 0 : DEFAULT_WEIGHTS.gender_weight,
      year_weight:
        existingForm?.mixYear === false ? 0 : DEFAULT_WEIGHTS.year_weight,
      buddy_weight:
        existingForm?.allowBuddy === false ? 0 : DEFAULT_WEIGHTS.buddy_weight,
    },
    topics: topicsFromCriteria,
    skills: existingForm?.criteria?.length
      ? existingForm.criteria.slice(0, 3).map((criterion, index) => ({
          id: `skill-${criterion.id}-${index}`,
          skill_label: criterion.question,
          skill_importance: Number((criterion.weight ?? 0.3).toFixed(2)),
        }))
      : [
          {
            id: "skill-1",
            skill_label: "Backend development",
            skill_importance: 0.5,
          },
          {
            id: "skill-2",
            skill_label: "Communication",
            skill_importance: 0.35,
          },
        ],
  };
}
