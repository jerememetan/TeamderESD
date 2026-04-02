import { fetchJson, invalidateFetchCache } from './httpClient';

const FORMATION_CONFIG_URL =
  import.meta.env.VITE_FORMATION_CONFIG_URL ?? 'http://localhost:8000/formation-config';

export async function fetchFormationConfig(sectionId) {
  const payload = await fetchJson(
    `${FORMATION_CONFIG_URL}?section_id=${encodeURIComponent(sectionId)}`,
    {
      headers: { Accept: 'application/json' },
    },
  );

  return payload;
}

export async function saveFormationConfig({ courseId, sectionId, criteria, topics, skills }) {
  const payload = await fetchJson(FORMATION_CONFIG_URL, {
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

  invalidateFetchCache('GET:http://localhost:8000/formation-config');
  return payload;
}
