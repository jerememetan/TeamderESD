// Build courses with groups from API data to match mockCourses structure
export function buildCoursesWithGroups(courses, sections) {
  return courses.map((course) => {
    const groups = sections
      .filter((section) => section.course_id === course.id)
      .map((section) => ({
        id: section.id,
        code: `${course.code}G${section.section_number}`,
        label: `Group ${section.section_number}`,
        studentsCount: 0, // Placeholder, update if you have this data
        teamsCount: 0, // Placeholder, update if you have this data
        formStatus: "unknown", // Placeholder
        lifecycleStage: "unknown", // Placeholder
      }));
    return {
      ...course,
      semester: "Unknown", // Placeholder
      groups,
    };
  });
}

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
