import { fetchJson } from "../../../../services/httpClient";

const DASHBOARD_URL =
  import.meta.env.VITE_DASHBOARD_URL ?? "http://localhost:8000/dashboard";

export async function fetchDashboardCoursesWithEnrollments() {
  const payload = await fetchJson(DASHBOARD_URL, {
    headers: { Accept: "application/json" },
    cache: true,
    ttlMs: 30000,
  });

  if (payload && payload.data) {
    return payload.data;
  }

  return {
    totalCourses: 0,
    totalGroups: 0,
    totalStudents: 0,
    pendingSwapRequests: 0,
  };
}
