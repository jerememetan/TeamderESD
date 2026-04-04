function mapStudentProfile(students = []) {
  return new Map(
    (Array.isArray(students) ? students : [])
      .filter((student) => Number.isFinite(Number(student?.backendStudentId)))
      .map((student) => [Number(student.backendStudentId), student]),
  );
}

function normalizeStudentRows(forms = [], studentById = new Map(), submitted = false) {
  return (Array.isArray(forms) ? forms : [])
    .map((form) => {
      const studentId = Number(form?.studentId);
      if (!Number.isFinite(studentId)) {
        return null;
      }

      const student = studentById.get(studentId);
      return {
        studentId,
        name: String(student?.name || `Student ${studentId}`),
        email: String(student?.email || ""),
        submitted,
      };
    })
    .filter(Boolean);
}

export function buildCompletionStatus(submittedForms = [], unsubmittedForms = [], students = []) {
  const studentById = mapStudentProfile(students);
  const submitted = normalizeStudentRows(submittedForms, studentById, true);
  const notSubmitted = normalizeStudentRows(unsubmittedForms, studentById, false);
  const total = submitted.length + notSubmitted.length;
  const percentage = total ? Math.round((submitted.length / total) * 100) : 0;

  return {
    total,
    submitted,
    notSubmitted,
    percentage,
  };
}
