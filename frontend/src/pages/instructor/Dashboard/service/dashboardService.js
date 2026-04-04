import { fetchJson } from "../../../../services/httpClient";
import { fetchAllCourses } from "../../../../services/courseService";
import { fetchAllEnrollments } from "../../../../services/enrollmentService";
import { fetchAllSections } from "../../../../services/sectionService";

const DASHBOARD_URL =
  import.meta.env.VITE_DASHBOARD_URL ?? "http://localhost:8000/dashboard";
const SWAP_REQUEST_URL =
  import.meta.env.VITE_SWAP_REQUEST_URL ?? "http://localhost:8000/swap-request";

function fallbackSummary() {
  return {
    totalCourses: 0,
    totalGroups: 0,
    totalStudents: 0,
    pendingSwapRequests: 0,
  };
}

function countPendingSwapRequests(requests = []) {
  return (Array.isArray(requests) ? requests : []).filter((request) => {
    const status = String(request?.status || "").trim().toLowerCase();
    return status === "pending";
  }).length;
}

async function fetchDashboardFromAtomicServices() {
  const fetchSwapRequests = async () => {
    const payload = await fetchJson(SWAP_REQUEST_URL, {
      headers: { Accept: "application/json" },
      cache: false,
    });

    const candidates = payload?.data?.data ?? payload?.data ?? payload;
    return Array.isArray(candidates) ? candidates : [];
  };

  const [coursesResult, sectionsResult, enrollmentsResult, swapsResult] =
    await Promise.allSettled([
      fetchAllCourses(),
      fetchAllSections(),
      fetchAllEnrollments(),
      fetchSwapRequests(),
    ]);

  return {
    totalCourses:
      coursesResult.status === "fulfilled" && Array.isArray(coursesResult.value)
        ? coursesResult.value.length
        : 0,
    totalGroups:
      sectionsResult.status === "fulfilled" && Array.isArray(sectionsResult.value)
        ? sectionsResult.value.length
        : 0,
    totalStudents:
      enrollmentsResult.status === "fulfilled" && Array.isArray(enrollmentsResult.value)
        ? new Set(
            enrollmentsResult.value
              .map((enrollment) => enrollment?.student_id)
              .filter((studentId) => studentId !== null && studentId !== undefined),
          ).size
        : 0,
    pendingSwapRequests:
      swapsResult.status === "fulfilled"
        ? countPendingSwapRequests(swapsResult.value)
        : 0,
  };
}

export async function fetchDashboardCoursesWithEnrollments() {
  try {
    const payload = await fetchJson(DASHBOARD_URL, {
      headers: { Accept: "application/json" },
      cache: true,
      ttlMs: 30000,
    });

    if (payload && payload.data) {
      return payload.data;
    }
  } catch {
    // Fall back to atomic services when dashboard orchestrator is unavailable.
  }

  try {
    return await fetchDashboardFromAtomicServices();
  } catch {
    return fallbackSummary();
  }
}
