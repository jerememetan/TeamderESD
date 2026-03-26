import { DEFAULT_WEIGHTS } from "./weights";

export function normalizeLoadedConfig(config, group, fallbackState) {
  const criteria = config?.criteria;
  if (!criteria) {
    return fallbackState;
  }

  const numGroups = Number(criteria.num_groups) || fallbackState.numGroups;
  const preferredGroupSize = Math.max(
    2,
    Math.ceil((group?.studentsCount ?? numGroups) / numGroups),
  );

  return {
    numGroups,
    preferredGroupSize,
    minimumGroupSize: fallbackState.minimumGroupSize,
    mixGender: Number(criteria.gender_weight ?? 0) > 0,
    mixYear: Number(criteria.year_weight ?? 0) > 0,
    allowBuddy: Number(criteria.buddy_weight ?? 0) > 0,
    weights: {
      ...DEFAULT_WEIGHTS,
      school_weight: Number(
        criteria.school_weight ?? DEFAULT_WEIGHTS.school_weight,
      ),
      year_weight: Number(criteria.year_weight ?? DEFAULT_WEIGHTS.year_weight),
      gender_weight: Number(
        criteria.gender_weight ?? DEFAULT_WEIGHTS.gender_weight,
      ),
      gpa_weight: Number(criteria.gpa_weight ?? DEFAULT_WEIGHTS.gpa_weight),
      reputation_weight: Number(
        criteria.reputation_weight ?? DEFAULT_WEIGHTS.reputation_weight,
      ),
      mbti_weight: Number(criteria.mbti_weight ?? DEFAULT_WEIGHTS.mbti_weight),
      buddy_weight: Number(
        criteria.buddy_weight ?? DEFAULT_WEIGHTS.buddy_weight,
      ),
      topic_weight: Number(
        criteria.topic_weight ?? DEFAULT_WEIGHTS.topic_weight,
      ),
      skill_weight: Number(
        criteria.skill_weight ?? DEFAULT_WEIGHTS.skill_weight,
      ),
      randomness: Number(criteria.randomness ?? DEFAULT_WEIGHTS.randomness),
    },
    topics: (config.topics ?? []).map((topic, index) => ({
      id: `topic-${index + 1}`,
      topic_label: topic.topic_label ?? "",
    })),
    skills: (config.skills ?? []).map((skill, index) => ({
      id: `skill-${index + 1}`,
      skill_label: skill.skill_label ?? "",
      skill_importance: Number(skill.skill_importance ?? 0.3),
    })),
  };
}
