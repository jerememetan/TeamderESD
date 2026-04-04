import { fetchJson } from './httpClient';

const STUDENT_URL = import.meta.env.VITE_STUDENT_URL ?? 'http://localhost:8000/students';

function normalizeStudentRecord(student, index) {
  const backendIdCandidate =
    student?.student_id ??
    student?.studentId ??
    student?.StudentId ??
    student?.id ??
    student?.Id ??
    index + 1;
  const numericBackendId = Number(
    typeof backendIdCandidate === "string"
      ? backendIdCandidate.replace(/[^0-9]/g, "") || backendIdCandidate
      : backendIdCandidate,
  );

  const normalizedId = String(student?.id ?? `s${backendIdCandidate}`);
  const normalizedStudentId = String(
    student?.studentId ?? student?.student_id ?? student?.StudentId ?? `ID-${backendIdCandidate}`,
  );

  return {
    id: normalizedId,
    name: student?.name ?? student?.Name ?? student?.full_name ?? student?.fullName ?? `Student ${backendIdCandidate}`,
    email: student?.email ?? student?.Email ?? '',
    year: student?.year ?? student?.Year ?? null,
    gender: student?.gender ?? student?.Gender ?? null,
    gpa: student?.gpa ?? student?.GPA ?? null,
    schoolId: student?.school_id ?? student?.schoolId ?? student?.SchoolId ?? null,
    studentId: normalizedStudentId,
    backendStudentId: Number.isFinite(numericBackendId) ? numericBackendId : null,
  };
}

function extractStudents(payload) {
  const candidates =
    payload?.data?.Students ??
    payload?.data?.students ??
    payload?.Students ??
    payload?.students ??
    payload?.data ??
    payload;

  if (!Array.isArray(candidates)) {
    return [];
  }

  return candidates
    .map((student, index) => normalizeStudentRecord(student, index))
    .filter((student) => Boolean(student.id));
}

export async function fetchAllStudents() {
  const payload = await fetchJson(STUDENT_URL);
  return extractStudents(payload);
}

export async function fetchStudentById(id){
  const payload = await fetchJson(STUDENT_URL + "/" + id);
  return payload.data || null;
}

export function buildStudentMapByBackendId(students = []) {
  return new Map(
    (Array.isArray(students) ? students : [])
      .filter((student) => Number.isFinite(Number(student?.backendStudentId)))
      .map((student) => [Number(student.backendStudentId), student]),
  );
}

export function buildSectionRoster(enrollments = [], students = []) {
  const studentsByBackendId = buildStudentMapByBackendId(students);
  const sectionStudentIds = Array.from(
    new Set(
      (Array.isArray(enrollments) ? enrollments : [])
        .map((enrollment) => Number(enrollment?.student_id))
        .filter((studentId) => Number.isFinite(studentId)),
    ),
  );

  return sectionStudentIds.map((studentId) => {
    const student = studentsByBackendId.get(studentId);
    return {
      student_id: studentId,
      profile: {
        name: String(student?.name || '').trim() || `Student ${studentId}`,
        email: String(student?.email || '').trim(),
        year: student?.year ?? null,
        gender: student?.gender ?? null,
        gpa: student?.gpa ?? null,
        school_id: student?.schoolId ?? null,
      },
    };
  });
}
