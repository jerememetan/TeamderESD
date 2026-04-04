
export function buildCourseBase(courses, sections, formMap = {}) {
  return courses.map((course) => ({
    id: course.id,
    name: course.name,
    code: course.code,
    groups: sections
      .filter((s) => s.course_id === course.id)
      .map((s) => ({
        id: s.id,
        code: `${course.code}G${s.section_number}`,
        label: `Group ${s.section_number}`,
        studentsCount: null,
        teamsCount: null,
        lifecycleStage: s.stage || 'setup',
        formSummary: formMap[s.id] || null,
      })),
  }));
}

export function mergeCourseCounts(courseList, enrollMap = {}, teamMap = {}) {
  return courseList.map((course) => ({
    ...course,
    groups: course.groups.map((group) => ({
      ...group,
      studentsCount: enrollMap[group.id] ?? 0,
      teamsCount: teamMap[group.id] ?? 0,
    })),
  }));
}

export function getCoursesStats(courses, sections, enrollMap, teamMap, formMap = {}) {
  return mergeCourseCounts(buildCourseBase(courses, sections, formMap), enrollMap, teamMap);
}
