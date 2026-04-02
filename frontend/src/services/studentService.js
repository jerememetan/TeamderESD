import { fetchJson } from './httpClient';

const STUDENT_URL = import.meta.env.VITE_STUDENT_URL ?? 'http://localhost:8000/students';

function normalizeStudentRecord(student, index) {
  const backendId =
    student?.student_id ??
    student?.studentId ??
    student?.StudentId ??
    student?.id ??
    student?.Id ??
    index + 1;

  const normalizedId = String(student?.id ?? `s${backendId}`);
  const normalizedStudentId = String(
    student?.studentId ?? student?.student_id ?? student?.StudentId ?? `ID-${backendId}`,
  );

  return {
    id: normalizedId,
    name: student?.name ?? student?.Name ?? student?.full_name ?? student?.fullName ?? `Student ${backendId}`,
    email: student?.email ?? student?.Email ?? '',
    studentId: normalizedStudentId,
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
