function toNonEmptyString(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function toNullableNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeCourseList(courses = []) {
  return (Array.isArray(courses) ? courses : []).map((course, courseIndex) => {
    const normalizedCode = toNonEmptyString(
      course?.code,
      `C${courseIndex + 1}`,
    );
    const groups = Array.isArray(course?.groups)
      ? course.groups.map((group, groupIndex) => {
          const sectionNumber = toNullableNumber(
            group?.sectionNumber ?? group?.section_number,
          );
          const defaultCode = sectionNumber
            ? `${normalizedCode}G${sectionNumber}`
            : `${normalizedCode}G${groupIndex + 1}`;
          return {
            id: toNonEmptyString(
              group?.id,
              `group-${courseIndex + 1}-${groupIndex + 1}`,
            ),
            code: toNonEmptyString(group?.code, defaultCode),
            label: toNonEmptyString(group?.label, `Group ${groupIndex + 1}`),
            studentsCount: toNullableNumber(
              group?.studentsCount ?? group?.students_count,
            ),
            teamsCount: toNullableNumber(
              group?.teamsCount ?? group?.teams_count,
            ),
            stage: toNonEmptyString(group?.stage, "setup").toLowerCase(),
            formSummary: group?.formSummary ?? null,
          };
        })
      : [];

    return {
      id: toNonEmptyString(course?.id, `course-${courseIndex + 1}`),
      code: normalizedCode,
      name: toNonEmptyString(course?.name, "Course"),
      groups,
    };
  });
}
