import { fetchJson } from "../../../../services/httpClient";
import { fetchAllCourses } from "../../../../services/courseService";
import { fetchAllEnrollments } from "../../../../services/enrollmentService";
import { fetchAllSections } from "../../../../services/sectionService";
import { fetchSwapReviewRequests } from "../../../../services/swapRequestService";

const DASHBOARD_URL =
  import.meta.env.VITE_DASHBOARD_URL ?? "http://localhost:8000/dashboard";

// TODO(api-backend): Implement and keep stable primary dashboard orchestrator contract.
// Endpoint: GET /dashboard
// Expected envelope: { code, data }
// Expected data object:
// {
//   totalCourses: number,
//   totalGroups: number,
//   totalStudents: number,
//   pendingSwapRequests: number
// }

// TODO(api-backend): Keep atomic fallback contracts backward compatible while dashboard orchestrator is unstable.
// Endpoint: GET /swap-request -> { code, data } where data may be nested as data.data
// It can return either this:
// {
// "code": 200,
// "data": [
//   {
//   "id": "sr_001",
//   "status": "pending",
//   "studentName": "Jereme Tan",
//   "courseName": "Software Engineering",
//   "currentTeamName": "Team Alpha",
//   "reason": "Scheduling clash",
//   "createdAt": "2026-04-05T09:12:33Z"
//   }
//   ]
// }

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
    const status = String(request?.status || "")
      .trim()
      .toLowerCase();
    return status === "pending";
  }).length;
}

async function fetchDashboardFromAtomicServices() {
  const fetchSwapRequests = async () => {
    // Aggregate pending requests per section via swap-orchestrator review composite.
    const sections = await fetchAllSections();
    const sectionIds = (Array.isArray(sections) ? sections : [])
      .map((section) => section?.id)
      .filter((id) => id !== null && id !== undefined)
      .map((id) => String(id));

    if (!sectionIds.length) {
      return 0;
    }

    const reviewResults = await Promise.allSettled(
      sectionIds.map((sectionId) =>
        fetchSwapReviewRequests({ sectionId, status: "pending" }),
      ),
    );

    return reviewResults.reduce((total, result) => {
      if (result.status !== "fulfilled") {
        return total;
      }

      const summaryPending = Number(result.value?.summary?.pending);
      if (Number.isFinite(summaryPending)) {
        return total + summaryPending;
      }

      const requests = Array.isArray(result.value?.requests)
        ? result.value.requests
        : [];
      return total + countPendingSwapRequests(requests);
    }, 0);
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
      sectionsResult.status === "fulfilled" &&
      Array.isArray(sectionsResult.value)
        ? sectionsResult.value.length
        : 0,
    totalStudents:
      enrollmentsResult.status === "fulfilled" &&
      Array.isArray(enrollmentsResult.value)
        ? new Set(
            enrollmentsResult.value
              .map((enrollment) => enrollment?.student_id)
              .filter(
                (studentId) => studentId !== null && studentId !== undefined,
              ),
          ).size
        : 0,
    pendingSwapRequests:
      swapsResult.status === "fulfilled" ? Number(swapsResult.value) || 0 : 0,
  };
}

export async function fetchDashboardCoursesWithEnrollments() {
  try {
    // TODO(api-backend): Preferred orchestrator endpoint for dashboard summary.
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
