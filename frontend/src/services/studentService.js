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
