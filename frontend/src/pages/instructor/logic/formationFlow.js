export const GROUP_STAGE = {
  SETUP: "setup",
  COLLECTING: "collecting",
  FORMING: "forming",
  FORMED: "formed",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
};

export function getEffectiveGroupStage(group, formingSectionIds = new Set()) {
  const sectionId = group?.id;
  if (sectionId && formingSectionIds.has(sectionId)) {
    return GROUP_STAGE.FORMING;
  }

  const backendStage = String(group?.stage ?? GROUP_STAGE.SETUP).toLowerCase();
  if (backendStage === GROUP_STAGE.SETUP) return GROUP_STAGE.SETUP;
  if (backendStage === GROUP_STAGE.COLLECTING) return GROUP_STAGE.COLLECTING;
  if (backendStage === GROUP_STAGE.FORMING) return GROUP_STAGE.FORMING;
  if (backendStage === GROUP_STAGE.FORMED) return GROUP_STAGE.FORMED;
  if (backendStage === GROUP_STAGE.CONFIRMED) return GROUP_STAGE.CONFIRMED;
  if (backendStage === GROUP_STAGE.COMPLETED) return GROUP_STAGE.COMPLETED;

  return GROUP_STAGE.SETUP;
}

export function isFormsRequired(formState) {
  const weights = formState?.weights || {};
  const topics = Array.isArray(formState?.topics) ? formState.topics : [];
  const skills = Array.isArray(formState?.skills) ? formState.skills : [];

  const buddyWeight = Number(weights.buddy_weight || 0);
  const mbtiWeight = Number(weights.mbti_weight || 0);
  const topicWeight = Number(weights.topic_weight || 0);
  const skillWeight = Number(weights.skill_weight || 0);

  const hasTopics = topics.some(
    (topic) => String(topic?.topic_label || "").trim().length > 0,
  );
  const hasSkills = skills.some(
    (skill) => String(skill?.skill_label || "").trim().length > 0,
  );

  return (
    buddyWeight !== 0 ||
    mbtiWeight !== 0 ||
    (topicWeight !== 0 && hasTopics) ||
    (skillWeight !== 0 && hasSkills)
  );
}
