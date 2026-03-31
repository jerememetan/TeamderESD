const FORMATION_CONFIG_URL =
  import.meta.env.VITE_FORMATION_CONFIG_URL ?? 'http://localhost:4000/formation-config';

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

export async function fetchFormationConfig(sectionId) {
  const response = await fetch(
    `${FORMATION_CONFIG_URL}?section_id=${encodeURIComponent(sectionId)}`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );

  return handleResponse(response, 'Unable to load formation config.');
}

export async function saveFormationConfig({ courseId, sectionId, criteria, topics, skills }) {
  const response = await fetch(FORMATION_CONFIG_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      course_id: courseId,
      section_id: sectionId,
      criteria,
      topics,
      skills,
    }),
  });
  console.log("RESPONSE", response);
  return handleResponse(response, 'Unable to save formation config.');
}
