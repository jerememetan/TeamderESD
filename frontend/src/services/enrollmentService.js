// handles all enrollment related services
import { fetchJson } from './httpClient';

const ENROLLMENT_URL = import.meta.env.VITE_ENROLLMENT_URL ?? "http://localhost:8000/enrollment";

export async function fetchAllEnrollments() {
  const json = await fetchJson(ENROLLMENT_URL);
  return json.data || [];
}

export async function fetchEnrollmentsBySectionId(sectionId) {
  const json = await fetchJson(`${ENROLLMENT_URL}?section_id=${encodeURIComponent(sectionId)}`);
  return json.data || [];
}

export async function fetchEnrollmentsBySections(sectionIds = []) {
  const uniqueSectionIds = Array.from(new Set(sectionIds.filter(Boolean)));
  if (uniqueSectionIds.length === 0) {
    return {};
  }

  const params = new URLSearchParams();
  params.set('section_ids', uniqueSectionIds.join(','));

  const payload = await fetchJson(`${ENROLLMENT_URL}?${params.toString()}`);
  const sections = payload?.data?.sections;
  if (!Array.isArray(sections)) {
    return {};
  }

  return sections.reduce((acc, sectionEntry) => {
    const sectionId = sectionEntry?.section_id;
    if (!sectionId) {
      return acc;
    }
    acc[sectionId] = Array.isArray(sectionEntry.enrollments)
      ? sectionEntry.enrollments
      : [];
    return acc;
  }, {});
}

export async function fetchEnrollmentCountBySectionId(sectionId) {
  const json = await fetchJson(`${ENROLLMENT_URL}?section_id=${encodeURIComponent(sectionId)}`);
  return json.data.length;
}