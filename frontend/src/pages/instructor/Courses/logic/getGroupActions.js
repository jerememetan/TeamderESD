export function getGroupActions(courseId, group, existingForm) {
  switch (group.lifecycleStage) {
    case "setup":
      return [
        {
          label: existingForm ? "Edit group form" : "Create group form",
          to: `/instructor/courses/${courseId}/groups/${group.id}/create-form`,
          variant: "default",
        },
      ];
    case "collecting":
      return [
        {
          label: "Edit group form",
          to: `/instructor/courses/${courseId}/groups/${group.id}/create-form`,
          variant: "default",
        },
        {
          label: "View completion status",
          to: `/instructor/courses/${courseId}/groups/${group.id}/analytics`,
          variant: "outline",
        },
      ];
    case "completed":
      return [
        {
          label: "View teams",
          to: `/instructor/courses/${courseId}/groups/${group.id}/teams`,
          variant: "default",
        },
        {
          label: "View analytics",
          to: `/instructor/courses/${courseId}/groups/${group.id}/analytics`,
          variant: "outline",
        },
        {
          label: "Start peer evaluation",
          to: `/instructor/courses/${courseId}/groups/${group.id}/teams`,
          variant: "outline",
        },
      ];
    case "formed":
    default:
      return [
        {
          label: "View teams",
          to: `/instructor/courses/${courseId}/groups/${group.id}/teams`,
          variant: "default",
        },
        {
          label: "View analytics",
          to: `/instructor/courses/${courseId}/groups/${group.id}/analytics`,
          variant: "outline",
        },
      ];
  }
}
