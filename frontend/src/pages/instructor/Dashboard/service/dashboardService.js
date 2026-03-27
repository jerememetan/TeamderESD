import { buildCoursesWithGroups } from "../logic/dashboardStats";

export async function fetchDashboardCourses() {
  // Fetch courses and sections, then build the dashboard structure
  const courseRes = await fetch("http://127.0.0.1:3017/api/courses");
  const courseJson = await courseRes.json();
  const courseArr = courseJson.data?.Courses || [];
  const sectionRes = await fetch("http://127.0.0.1:3018/section");
  const sectionJson = await sectionRes.json();
  const sectionArr = sectionJson.data || [];
  return buildCoursesWithGroups(courseArr, sectionArr);
}
