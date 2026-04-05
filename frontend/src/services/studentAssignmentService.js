import { fetchAllCourses } from "./courseService";
import { fetchAllSections } from "./sectionService";
import { fetchAllStudents, buildStudentMapByBackendId } from "./studentService";
import { fetchTeamsBySection } from "./teamService";

function normalizeCourse(course, index) {
  return {
    id: String(course?.id ?? course?.course_id ?? index + 1),
    code: course?.code ?? course?.course_code ?? `COURSE-${index + 1}`,
    name: course?.name ?? course?.course_name ?? `Course ${index + 1}`,
  };
}

function normalizeSection(section, index) {
  return {
    id: String(section?.id ?? section?.section_id ?? ""),
    courseId: String(section?.course_id ?? section?.courseId ?? ""),
    sectionNumber: Number(
      section?.section_number ?? section?.sectionNumber ?? index + 1,
    ),
    stage: section?.stage ?? "setup",
  };
}

export async function fetchStudentAssignments({ studentProfile }) {
  const backendStudentId = Number(studentProfile?.backendStudentId);
  if (!Number.isFinite(backendStudentId)) {
    throw new Error(
      "Unable to resolve a backend student id for the selected student.",
    );
  }

  const [courseRecords, sectionRecords] = await Promise.all([
    fetchAllCourses(),
    fetchAllSections(),
  ]);
  const studentDirectory = await fetchAllStudents();
  const studentsByBackendId = buildStudentMapByBackendId(studentDirectory);

  const courses = Array.isArray(courseRecords)
    ? courseRecords.map(normalizeCourse)
    : [];
  const sections = Array.isArray(sectionRecords)
    ? sectionRecords
        .map(normalizeSection)
        .filter((section) => Boolean(section.id))
    : [];
  const courseById = new Map(courses.map((course) => [course.id, course]));

  const sectionResults = await Promise.allSettled(
    sections.map(async (section) => {
      const teams = await fetchTeamsBySection(section.id);

      return { section, teams };
    }),
  );

  const failure = sectionResults.find((result) => result.status === "rejected");
  if (failure) {
    throw failure.reason instanceof Error
      ? failure.reason
      : new Error(
          "Unable to connect to the backend team or student profile service.",
        );
  }

  const assignments = [];

  for (const result of sectionResults) {
    if (result.status !== "fulfilled") {
      continue;
    }

    const { section, teams } = result.value;
    const matchingTeam = teams.find((team) =>
      (team.students ?? []).some(
        (student) => Number(student.student_id) === backendStudentId,
      ),
    );

    if (!matchingTeam) {
      continue;
    }

    const course = courseById.get(String(section.courseId)) ?? null;

    const members = (matchingTeam.students ?? []).map((student) => {
      const studentBackendId = Number(student.student_id);
      const rosterEntry = studentsByBackendId.get(studentBackendId);

      return {
        id: String(studentBackendId),
        name:
          String(rosterEntry?.name || "").trim() ||
          `Student ${studentBackendId}`,
        email: String(rosterEntry?.email || "").trim() || "No email available",
        studentId: `ID-${studentBackendId}`,
        confirmationStatus: "confirmed",
      };
    });

    assignments.push({
      id: matchingTeam.team_id,
      courseId: String(section.courseId || course?.id || ""),
      courseCode: course?.code || `COURSE-${section.courseId || "UNKNOWN"}`,
      courseName: course?.name || `Course ${section.courseId || "Unknown"}`,
      sectionId: section.id,
      sectionNumber: section.sectionNumber,
      groupId: section.id,
      groupCode: course?.code
        ? `${course.code}G${section.sectionNumber}`
        : section.id,
      groupLabel: `Group ${section.sectionNumber}`,
      name: `Team ${String(matchingTeam.team_number ?? assignments.length + 1).padStart(2, "0")}`,
      members,
      source: "backend",
    });
  }

  return assignments;
}
