


export function getCoursesStats(courses, sections, enrollMap, teamMap, formMap = {}) {
  return courses.map(course => ({
    id: course.id,
    name: course.name,
    code: course.code,
    groups: sections
      .filter(s => s.course_id === course.id)
      .map(s => ({
        id: s.id,
        code: `${course.code}G${s.section_number}`,
        label: `Group ${s.section_number}`,
        studentsCount: enrollMap[s.id] || 0,
        teamsCount: teamMap[s.id] || 0,
        lifecycleStage: s.stage || 'setup',
        formSummary: formMap[s.id] || null,
      })),
  }));
}