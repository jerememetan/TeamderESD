import { fetchJson } from './httpClient';

const TEAM_URL = import.meta.env.VITE_TEAM_URL ?? 'http://localhost:8000/team';

export async function fetchTeamsBySection(sectionId) {
  const payload = await fetchJson(`${TEAM_URL}?section_id=${encodeURIComponent(sectionId)}`, {
    headers: { Accept: 'application/json' },
  });

  return payload?.data?.teams ?? [];
}

export async function fetchTeamById(teamId) {
  if (!teamId) {
    return null;
  }

  const payload = await fetchJson(`${TEAM_URL}/${encodeURIComponent(teamId)}`, {
    headers: { Accept: 'application/json' },
  });

  const team = payload?.data;
  if (!team || typeof team !== 'object') {
    return null;
  }

  const teamNumber = team.team_number;
  const displayName = Number.isFinite(teamNumber)
    ? `Team ${teamNumber}`
    : team.team_name || team.name || String(team.team_id || teamId);

  return {
    ...team,
    displayName,
  };
}

export async function fetchTeamsBySections(sectionIds = []) {
  const uniqueSectionIds = Array.from(new Set(sectionIds.filter(Boolean)));
  if (uniqueSectionIds.length === 0) {
    return {};
  }

  const params = new URLSearchParams();
  params.set('section_ids', uniqueSectionIds.join(','));

  const payload = await fetchJson(`${TEAM_URL}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });

  const sections = payload?.data?.sections;
  if (!Array.isArray(sections)) {
    return {};
  }

  return sections.reduce((acc, sectionEntry) => {
    const sectionId = sectionEntry?.section_id;
    if (!sectionId) {
      return acc;
    }
    acc[sectionId] = Array.isArray(sectionEntry.teams) ? sectionEntry.teams : [];
    return acc;
  }, {});
}


