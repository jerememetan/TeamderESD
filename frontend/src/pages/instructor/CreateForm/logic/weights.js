export const WEIGHT_FIELDS = [
  {
    key: "skill_weight",
    label: "Skill balance",
    helper: "How strongly to balance technical skills across teams.",
    positiveDescription:
      "Students with stronger and weaker levels in this skill are spread more evenly across teams.",
    zeroDescription:
      "Skill balance is ignored when forming teams.",
    negativeDescription:
      "Students with similar skill levels are grouped together, creating more specialized teams.",
    negativeWarning:
      "Negative skill balance groups similar skill levels together and reduces balance across teams. This is generally not correct for balanced teamwork, but you can keep it if specialization is your goal.",
  },
  {
    key: "topic_weight",
    label: "Topic preference",
    helper: "How strongly topic interest should shape teams.",
    positiveDescription:
      "Students who prefer similar topics are grouped together more strongly.",
    zeroDescription:
      "Topic preference is ignored when forming teams.",
    negativeDescription:
      "Students with different topic preferences are intentionally mixed across teams.",
    negativeWarning:
      "Negative topic preference pushes students with different topic interests together. This is generally not correct for topic alignment, but you can keep it if broader topic mixing is intentional.",
  },
  {
    key: "buddy_weight",
    label: "Buddy requests",
    helper: "How strongly to respect preferred teammate requests.",
    positiveDescription:
      "Buddy-linked students are more likely to be placed on the same team.",
    zeroDescription: "Buddy requests are ignored when forming teams.",
    negativeDescription:
      "Buddy-linked students are more likely to be separated into different teams.",
    negativeWarning:
      "Negative buddy weight separates buddy-linked students across teams. This is generally not correct for buddy requests, but you can keep it if separation is intentional.",
  },
  {
    key: "year_weight",
    label: "Year mix",
    helper: "How strongly to mix students from different years.",
    positiveDescription:
      "Each team is encouraged to include a mix of students from different years.",
    zeroDescription: "Year mix is ignored when forming teams.",
    negativeDescription:
      "Students from the same year are grouped together more often.",
    negativeWarning:
      "Negative year mix groups students by the same year instead of mixing cohorts. This is generally not correct for balanced teams, but you can keep it if year-based grouping is intentional.",
  },
  {
    key: "gender_weight",
    label: "Gender mix",
    helper: "How strongly to balance gender across teams.",
    positiveDescription:
      "Teams are encouraged to have a more balanced gender distribution.",
    zeroDescription: "Gender mix is ignored when forming teams.",
    negativeDescription:
      "Students of similar gender are grouped together more often.",
    negativeWarning:
      "Negative gender mix pushes similar genders into the same teams instead of balancing distribution. This is generally not correct for diverse teams, but you can keep it if this grouping is intentional.",
  },
  {
    key: "gpa_weight",
    label: "GPA balance",
    helper: "How strongly to balance academic performance.",
    positiveDescription:
      "Higher and lower GPA students are mixed more evenly across teams.",
    zeroDescription: "GPA balance is ignored when forming teams.",
    negativeDescription:
      "Students with similar GPA levels are grouped together more often.",
    negativeWarning:
      "Negative GPA balance clusters similar GPA students together. This is generally not correct for balanced teams, but you can keep it if academic-level clustering is intentional.",
  },
  {
    key: "reputation_weight",
    label: "Reputation",
    helper: "How strongly to spread high-reputation students.",
    positiveDescription:
      "Students with stronger and weaker reputation signals are spread more evenly across teams.",
    zeroDescription: "Reputation is ignored when forming teams.",
    negativeDescription:
      "Students with similar reputation levels are grouped together more often.",
    negativeWarning:
      "Negative reputation weight clusters students with similar reputation together. This is generally not correct for balanced teams, but you can keep it if this clustering is intentional.",
  },
  {
    key: "school_weight",
    label: "School mix",
    helper: "How strongly to mix students across schools.",
    positiveDescription:
      "Teams are encouraged to include students from different schools.",
    zeroDescription: "School mix is ignored when forming teams.",
    negativeDescription:
      "Students from the same school are grouped together more often.",
    negativeWarning:
      "Negative school mix groups students by school instead of mixing schools. This is generally not correct for diverse teams, but you can keep it if school-based grouping is intentional.",
  },
  {
    key: "mbti_weight",
    label: "MBTI mix",
    helper: "How strongly to account for personality data.",
    positiveDescription:
      "Teams are encouraged to include a broader mix of MBTI traits.",
    zeroDescription: "MBTI mix is ignored when forming teams.",
    negativeDescription:
      "Students with similar MBTI traits are grouped together more often.",
    negativeWarning:
      "Negative MBTI mix groups similar MBTI traits together instead of balancing team composition. This is generally not correct for diverse teams, but you can keep it if trait-based grouping is intentional.",
  },
  {
    key: "randomness",
    label: "Randomness",
    helper: "How much variety to allow beyond strict optimization.",
    positiveDescription:
      "The solver explores more alternative valid team arrangements while keeping quality constraints.",
    zeroDescription:
      "No randomness is added, so the solver is fully deterministic for the same input.",
  },
];

const WEIGHT_FIELD_LOOKUP = WEIGHT_FIELDS.reduce((lookup, field) => {
  lookup[field.key] = field;
  return lookup;
}, {});

const EPSILON = 0.0001;

export const WEIGHT_STEP = 0.05;

export function getWeightField(weightKey) {
  return WEIGHT_FIELD_LOOKUP[weightKey] || null;
}

export function getWeightSliderBounds(weightKey) {
  if (weightKey === "randomness") {
    return { min: 0, max: 1, step: WEIGHT_STEP };
  }
  return { min: -1, max: 1, step: WEIGHT_STEP };
}

export function clampWeightValue(weightKey, value) {
  const numericValue = Number.isFinite(value) ? value : Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
  const { min, max } = getWeightSliderBounds(weightKey);
  return Math.max(min, Math.min(max, safeValue));
}

export function getWeightDescription(weightKey, value) {
  const field = getWeightField(weightKey);
  if (!field) {
    return "";
  }

  const numericValue = Number(value) || 0;
  if (Math.abs(numericValue) < EPSILON) {
    return field.zeroDescription || "";
  }
  if (numericValue < 0) {
    return field.negativeDescription || field.zeroDescription || "";
  }
  return field.positiveDescription || field.zeroDescription || "";
}

export function getNegativeWeightWarning(weightKey, value) {
  if (weightKey === "randomness") {
    return "";
  }

  const numericValue = Number(value) || 0;
  if (numericValue >= 0) {
    return "";
  }

  const field = getWeightField(weightKey);
  return field?.negativeWarning || "";
}

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
