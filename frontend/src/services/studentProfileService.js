import { fetchJson } from './httpClient';

const STUDENT_PROFILE_URL =
  import.meta.env.VITE_STUDENT_PROFILE_URL ?? 'http://localhost:8000/student-profile';

export async function fetchStudentProfile(sectionId) {
  const payload = await fetchJson(
    console.log("fetching:", sectionId)
      `${STUDENT_PROFILE_URL}?section_id=${encodeURIComponent(sectionId)}`,
    {
      headers: { Accept: 'application/json' },
    },
  );

  return payload?.data?.students ?? [];
}
