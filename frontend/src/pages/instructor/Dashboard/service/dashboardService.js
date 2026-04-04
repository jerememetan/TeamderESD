import { fetchJson } from "../../../../services/httpClient";
import { fetchAllCourses } from "../../../../services/courseService";
import { fetchAllEnrollments } from "../../../../services/enrollmentService";
import { fetchAllSections } from "../../../../services/sectionService";

const DASHBOARD_URL =
  import.meta.env.VITE_DASHBOARD_URL ?? "http://localhost:8000/dashboard";
const SWAP_REQUEST_URL =
  import.meta.env.VITE_SWAP_REQUEST_URL ?? "http://localhost:8000/swap-request";

// API integration map (primary orchestrator path):
// GET /dashboard
// Expected envelope: { code, data }
// Expected data object:
// {
//   totalCourses: number,
//   totalGroups: number,
//   totalStudents: number,
//   pendingSwapRequests: number
// }

// API integration map (atomic fallback path):
// GET /courses -> { code, data: { Courses: Course[] } }
// GET /section -> { code, data: Section[] }
// GET /enrollment -> { code, data: Enrollment[] }
// GET /swap-request -> { code, data } where data may be nested as data.data
// Fallback summary object returned by this service must always match:
// {
//   totalCourses: number,
//   totalGroups: number,
//   totalStudents: number,
//   pendingSwapRequests: number
// }

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
    // Endpoint: GET /swap-request
    // Supported payload shapes observed:
    // 1) { code, data: SwapRequest[] }
    // 2) { code, data: { data: SwapRequest[] } }
    // SwapRequest object fields used here: { status }
    const payload = await fetchJson(SWAP_REQUEST_URL, {
      headers: { Accept: "application/json" },
      cache: false,
    });

    const candidates = payload?.data?.data ?? payload?.data ?? payload;
    return Array.isArray(candidates) ? candidates : [];
  };

  const [coursesResult, sectionsResult, enrollmentsResult, swapsResult] =
    await Promise.allSettled([
      // Endpoint: GET /courses
      // Expected array item fields for this aggregate: only length is required.
      fetchAllCourses(),
      // Endpoint: GET /section
      // Expected array item fields for this aggregate: only length is required.
      fetchAllSections(),
      // Endpoint: GET /enrollment
      // Expected array item fields used here: { student_id } for unique student count.
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
    // Primary endpoint: GET /dashboard
    // Preferred source because backend orchestrator owns dashboard contract.
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
    // Atomic fallback path keeps dashboard usable if orchestrator endpoint fails.
    return await fetchDashboardFromAtomicServices();
  } catch {
    // Last-resort defensive fallback for complete backend outage.
    return fallbackSummary();
  }
}
