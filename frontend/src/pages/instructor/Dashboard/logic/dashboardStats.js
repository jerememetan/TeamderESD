// Build courses with groups from API data to match mockCourses structure
// Optionally takes enrollments to populate studentsCount per group
export function buildCoursesWithGroups(courses, sections, enrollments = []) {
  return courses.map((course) => {
    const groups = sections
      .filter((section) => section.course_id === course.id)
      .map((section) => {
        // Count students in this group/section
        const studentsCount = enrollments.filter(
          (enr) => enr.section_id === section.id
        ).length;
        return {
          id: section.id,
          code: `${course.code}G${section.section_number}`,
          label: `Group ${section.section_number}`,
          studentsCount,
          teamsCount: 0, // Placeholder, update if you have this data
          formStatus: "unknown", // Placeholder
          lifecycleStage: "unknown", // Placeholder
        };
      });
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
