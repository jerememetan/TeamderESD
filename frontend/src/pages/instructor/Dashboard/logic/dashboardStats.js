// Build courses with groups from API data to match mockCourses structure
// Optionally takes enrollments to populate studentsCount per group

export function getDashboardStats(courseList, sectionArr, enrollments, swapRequestList) {
  const totalCourses = courseList.length;
  const totalGroups = sectionArr.length;
  const totalStudents = enrollments.length;
  const pendingSwapRequests = swapRequestList.filter(
    (request) => request.status === "pending",
  ).length;

  return {
    totalCourses,
    totalGroups,
    totalStudents,
    pendingSwapRequests,
  };
}
