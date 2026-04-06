// takes in conversion of cell strucuture for the cards
import { GROUP_STAGE, getEffectiveGroupStage } from "../../logic/formationFlow";

// uses the requires the current group object, the course id checks the existance of a form
export function getGroupActions(courseCode, group, options = {}) {
  const stage = getEffectiveGroupStage(group, options.formingSectionIds);

  switch (stage) {
    case GROUP_STAGE.SETUP:
      return [
        {
          label: "Configure formation criteria",
          to: `/instructor/courses/${courseCode}/groups/${group.id}/create-form`,
          variant: "default",
        },
      ];
    case GROUP_STAGE.COLLECTING:
      return [
        {
          label: "View formation criteria",
          to: `/instructor/courses/${courseCode}/groups/${group.id}/create-form?mode=view`,
          variant: "default",
        },
        {
          label: "View completion status",
          to: `/instructor/courses/${courseCode}/groups/${group.id}/completion-status`,
          variant: "outline",
        },
        {
          label: options.isEndingCollection
            ? "Ending collection..."
            : "End form collection",
          kind: "button",
          onClick: () => options.onEndCollection?.(courseCode, group),
          variant: "outline",
          disabled: Boolean(options.isEndingCollection),
        },
      ];
    case GROUP_STAGE.FORMING:
      return [
        {
          label: "View formation criteria",
          to: `/instructor/courses/${courseCode}/groups/${group.id}/create-form?mode=view`,
          variant: "outline",
        },
      ];
    case GROUP_STAGE.FORMED:
      return [
        {
          label: "View teams",
          to: `/instructor/courses/${courseCode}/groups/${group.id}/teams`,
          variant: "default",
        },
        {
          label: "View analytics",
          to: `/instructor/courses/${courseCode}/groups/${group.id}/analytics`,
          variant: "outline",
        },
      ];
    case GROUP_STAGE.CONFIRMED:
      return [
        {
          label: "View teams",
          to: `/instructor/courses/${courseCode}/groups/${group.id}/teams`,
          variant: "default",
        },
        {
          label: "View analytics",
          to: `/instructor/courses/${courseCode}/groups/${group.id}/analytics`,
          variant: "outline",
        },
        {
          label: "Start peer evaluation",
          to: `/instructor/courses/${courseCode}/groups/${group.id}/teams`,
          variant: "outline",
        },
      ];
    case GROUP_STAGE.COMPLETED:
      return [
        {
          label: "View teams",
          to: `/instructor/courses/${courseCode}/groups/${group.id}/teams`,
          variant: "default",
        },
        {
          label: "View analytics",
          to: `/instructor/courses/${courseCode}/groups/${group.id}/analytics`,
          variant: "outline",
        },
      ];
    default:
      return [
        {
          label: "Configure formation criteria",
          to: `/instructor/courses/${courseCode}/groups/${group.id}/create-form`,
          variant: "default",
        },
      ];
  }
}
