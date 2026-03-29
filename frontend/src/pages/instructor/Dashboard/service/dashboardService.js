import {getDashboardStats } from "../logic/dashboardStats";
import { fetchAllEnrollments } from "./enrollmentService";


// Gets courses via http://127.0.0.1:3017/api/courses
// Gets section via http://127.0.0.1:3018/section
// gets enrollment via http://localhost:3005/enrollment
// gets swapRequests via http://localhost:3011/swap-request

export async function fetchDashboardCoursesWithEnrollments() {
  // Fetch courses, sections, and enrollments, then build the dashboard structure
  // fetch all relevant information from the api, get the json data
  const courseRes = await fetch("http://127.0.0.1:3017/api/courses");
  const courseJson = await courseRes.json();
  const courseArr = courseJson.data?.Courses || [];
  
  const sectionRes = await fetch("http://127.0.0.1:3018/section");
  const sectionJson = await sectionRes.json();
  const sectionArr = sectionJson.data || [];

  const enrollments = await fetchAllEnrollments();
  // const swapRequestRes = [await fetch("http://localhost:3011/swap-request");]
  // const swapRequest = swapRequestRes.json();
  // const swapArr = swapRequest.data?.Courses || [];
  return getDashboardStats(courseArr, sectionArr, enrollments, []);
}
