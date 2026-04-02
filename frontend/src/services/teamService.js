import { fetchJson } from './httpClient';

const TEAM_URL = import.meta.env.VITE_TEAM_URL ?? 'http://localhost:8000/team';

export async function fetchTeamsBySection(sectionId) {
  const payload = await fetchJson(`${TEAM_URL}?section_id=${encodeURIComponent(sectionId)}`, {
    headers: { Accept: 'application/json' },
  });

  return payload?.data?.teams ?? [];
}


