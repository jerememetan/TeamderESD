import { getDashboardStats } from "../logic/dashboardStats";
import { fetchAllEnrollments } from "../../../../services/enrollmentService";
import { fetchAllCourses } from "../../../../services/courseService";
import { fetchAllSections } from "../../../../services/sectionService";
// Gets courses via Kong at /api/courses
// Gets section via Kong at /section
// Gets enrollment via Kong at /enrollment
// Swap requests are available via Kong at /swap-request

export async function fetchDashboardCoursesWithEnrollments() {
  // Fetch courses, sections, and enrollments, then build the dashboard structure
  // fetch all relevant information from the api, get the json data

  const [courseArr, sectionArr, enrollments] = await Promise.all([
    fetchAllCourses(),
    fetchAllSections(),
    fetchAllEnrollments(),
  ]);
  // const swapRequestRes = [await fetch("http://localhost:8000/swap-request");]
  // const swapRequest = swapRequestRes.json();
  // const swapArr = swapRequest.data?.Courses || [];
  return getDashboardStats(courseArr, sectionArr, enrollments, []);
}
