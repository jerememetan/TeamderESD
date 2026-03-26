export function getDashboardStats(courseList, swapRequestList) {
  const courseGroups = courseList.flatMap((course) => course.groups);
  const totalCourses = courseList.length;
  const totalGroups = courseGroups.length;
  const totalStudents = courseGroups.reduce(
    (sum, group) => sum + group.studentsCount,
    0,
  );
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
