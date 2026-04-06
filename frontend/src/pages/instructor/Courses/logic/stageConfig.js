export const STAGE_CONFIG = {
  setup: {
    label: "Setup",
    tone: "neutral",
    note: "No formation criteria has been configured yet.",
  },
  collecting: {
    label: "Collecting responses",
    tone: "alert",
    note: "Student form links are active and responses are being collected.",
  },
  forming: {
    label: "Forming teams",
    tone: "alert",
    note: "Team formation is currently running for this group.",
  },
  formed: {
    label: "Teams formed",
    tone: "success",
    note: "Teams are available for review, analytics, and swap decisions.",
  },
  confirmed: {
    label: "Swaps confirmed",
    tone: "success",
    note: "Swap decisions are finalized and teams are locked for this section.",
  },
  completed: {
    label: "Completed",
    tone: "success",
    note: "Section workflow is complete. Historical teams and analytics remain available.",
  },
};
