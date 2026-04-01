const DASHBOARD_URL =
  import.meta.env.VITE_DASHBOARD_URL ?? "http://localhost:4003/dashboard";

export async function fetchDashboardCoursesWithEnrollments() {
  const res = await fetch(DASHBOARD_URL, {
    headers: { Accept: "application/json" },
  });
  const payload = await res.json().catch(() => ({}));
  // If the composite returned a top-level data object with totals, use it.
  if (payload && payload.data) {
    return payload.data;
  }

  // Fallback: return empty totals
  return {
    totalCourses: 0,
    totalGroups: 0,
    totalStudents: 0,
    pendingSwapRequests: 0,
  };
}
