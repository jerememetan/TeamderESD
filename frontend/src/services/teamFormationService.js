const TEAM_FORMATION_URL =
  import.meta.env.VITE_TEAM_FORMATION_URL ?? 'http://localhost:4002/team-formation';

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

export async function generateTeamsForSection(sectionId) {
  const response = await fetch(
    `${TEAM_FORMATION_URL}?section_id=${encodeURIComponent(sectionId)}`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );

  const payload = await handleResponse(response, 'Unable to generate teams for this section.');
  return payload?.data?.teams ?? [];
}
