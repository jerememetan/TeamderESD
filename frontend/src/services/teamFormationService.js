import { fetchJson, invalidateFetchCache } from './httpClient';

const TEAM_FORMATION_URL =
  import.meta.env.VITE_TEAM_FORMATION_URL ?? 'http://localhost:8000/team-formation';

export async function generateTeamsForSection(sectionId) {
  const payload = await fetchJson(TEAM_FORMATION_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ section_id: sectionId }),
  });

  invalidateFetchCache('GET:http://localhost:8000/team');
  return payload?.data?.teams ?? [];
}
