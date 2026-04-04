export function getInstructorLoadErrorMessage(contextLabel, error) {
  const detail = error?.message || String(error || "Unknown error");
  return `${contextLabel} failed: ${detail}`;
}
