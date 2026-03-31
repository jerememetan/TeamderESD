const TEAM_URL = import.meta.env.VITE_TEAM_URL ?? 'http://localhost:3007/team';

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

export async function fetchTeamsBySection(sectionId) {
  console.log("fetching teams")
  const response = await fetch(`${TEAM_URL}?section_id=${encodeURIComponent(sectionId)}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  const payload = await handleResponse(response, 'Unable to load teams for this section.');
  return payload?.data?.teams ?? [];
}


