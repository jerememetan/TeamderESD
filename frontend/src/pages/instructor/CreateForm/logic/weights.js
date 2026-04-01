export const WEIGHT_FIELDS = [
  {
    key: "skill_weight",
    label: "Skill balance",
    helper: "How strongly to balance technical skills across teams.",
  },
  {
    key: "topic_weight",
    label: "Topic preference",
    helper: "How strongly topic interest should shape teams.",
  },
  {
    key: "buddy_weight",
    label: "Buddy requests",
    helper: "How strongly to respect preferred teammate requests.",
  },
  {
    key: "year_weight",
    label: "Year mix",
    helper: "How strongly to mix students from different years.",
  },
  {
    key: "gender_weight",
    label: "Gender mix",
    helper: "How strongly to balance gender across teams.",
  },
  {
    key: "gpa_weight",
    label: "GPA balance",
    helper: "How strongly to balance academic performance.",
  },
  {
    key: "reputation_weight",
    label: "Reputation",
    helper: "How strongly to spread high-reputation students.",
  },
  {
    key: "school_weight",
    label: "School mix",
    helper: "How strongly to mix students across schools.",
  },
  {
    key: "mbti_weight",
    label: "MBTI mix",
    helper: "How strongly to account for personality data.",
  },
  {
    key: "randomness",
    label: "Randomness",
    helper: "How much variety to allow beyond strict optimization.",
  },
];

export const DEFAULT_WEIGHTS = {
  school_weight: 0.0,
  year_weight: 0.0,
  gender_weight: 0.0,
  gpa_weight: 0.0,
  reputation_weight: 0.0,
  mbti_weight: 0.0,
  buddy_weight: 0.0,
  topic_weight: 0.0,
  skill_weight: 0,
  randomness: 0.0,
};
