const DASHBOARD_URL =
  import.meta.env.VITE_DASHBOARD_URL ?? "http://localhost:8000/dashboard";

export async function fetchDashboardCoursesWithEnrollments() {
  const res = await fetch(DASHBOARD_URL, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Dashboard request failed with status ${res.status}`);
  }

  const payload = await res.json().catch(() => ({}));

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
