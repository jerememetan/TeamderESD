export function buildSavePayload(formState, backendCourseId, backendSectionId) {
  return {
    courseId: backendCourseId,
    sectionId: backendSectionId,
    criteria: {
      course_id: backendCourseId,
      section_id: backendSectionId,
      num_groups: Number(formState.numGroups),
      school_weight: Number(formState.weights.school_weight),
      year_weight: formState.mixYear
        ? Number(formState.weights.year_weight)
        : 0,
      gender_weight: formState.mixGender
        ? Number(formState.weights.gender_weight)
        : 0,
      gpa_weight: Number(formState.weights.gpa_weight),
      reputation_weight: Number(formState.weights.reputation_weight),
      mbti_weight: Number(formState.weights.mbti_weight),
      buddy_weight: formState.allowBuddy
        ? Number(formState.weights.buddy_weight)
        : 0,
      topic_weight: Number(formState.weights.topic_weight),
      skill_weight: Number(formState.weights.skill_weight),
      randomness: Number(formState.weights.randomness),
    },
    topics: formState.topics
      .map((topic) => topic.topic_label.trim())
      .filter(Boolean)
      .map((topic_label) => ({ topic_label })),
    skills: formState.skills
      .map((skill) => ({
        skill_label: skill.skill_label.trim(),
        skill_importance: Number(skill.skill_importance),
      }))
      .filter((skill) => skill.skill_label),
  };
}

export function buildPublishPayload(
  formState,
  backendCourseId,
  backendSectionId,
) {
  return {
    section_id: backendSectionId,
    criteria: {
      course_id: backendCourseId,
      section_id: backendSectionId,
      num_groups: Number(formState.numGroups),
      school_weight: Number(formState.weights.school_weight),
      year_weight: formState.mixYear
        ? Number(formState.weights.year_weight)
        : 0,
      gender_weight: formState.mixGender
        ? Number(formState.weights.gender_weight)
        : 0,
      gpa_weight: Number(formState.weights.gpa_weight),
      reputation_weight: Number(formState.weights.reputation_weight),
      mbti_weight: Number(formState.weights.mbti_weight),
      buddy_weight: formState.allowBuddy
        ? Number(formState.weights.buddy_weight)
        : 0,
      topic_weight: Number(formState.weights.topic_weight),
      skill_weight: Number(formState.weights.skill_weight),
      randomness: Number(formState.weights.randomness),
    },
    custom_entries: formState.skills
      .filter((skill) => skill.skill_label.trim())
      .map((skill, index) => ({
        key: `skill_${index + 1}`,
        label: skill.skill_label.trim(),
        input_type: "number",
        required: true,
        weight: Number(skill.skill_importance || 0),
      })),
    base_form_url: `${window.location.origin}/student/fill-form`,
  };
}
