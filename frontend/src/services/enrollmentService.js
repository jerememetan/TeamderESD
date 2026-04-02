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

export async function fetchEnrollmentCountBySectionId(sectionId) {
  const json = await fetchJson(`${ENROLLMENT_URL}?section_id=${encodeURIComponent(sectionId)}`);
  return json.data.length;
}