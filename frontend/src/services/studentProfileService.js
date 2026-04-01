const STUDENT_PROFILE_URL =
  import.meta.env.VITE_STUDENT_PROFILE_URL ?? 'http://localhost:4001/student-profile';

async function parseJson(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function handleResponse(response, fallbackMessage) {
  const payload = await parseJson(response);

  if (!response.ok) {
    const message = payload.error || payload.message || fallbackMessage;
    throw new Error(message);
  }

  return payload;
}

export async function fetchStudentProfile(sectionId) {
  console.log("fetching:", sectionId)
  const response = await fetch(
    `${STUDENT_PROFILE_URL}?section_id=${encodeURIComponent(sectionId)}`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );

  const payload = await handleResponse(response, 'Unable to load section student profile.');
  return payload?.data?.students ?? [];
}
