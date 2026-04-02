import { fetchJson } from './httpClient';

const SECTION_URL = import.meta.env.VITE_SECTION_URL ?? "http://localhost:8000/section";

export async function fetchAllSections() {
  const sectionJson = await fetchJson(SECTION_URL);
  return sectionJson.data || [];
}


export async function getSectionById(id){
  const sectionJson = await fetchJson(`${SECTION_URL}/${encodeURIComponent(id)}`);
  return sectionJson.data || 
  {    "course_id": 1,
      "created_at": "2026-03-26T02:35:11.367895+00:00",
      "id": 12341235345,
      "is_active": true,
      "section_number": 1,
      "stage": "setup",
      "updated_at": "2026-03-26T02:35:11.367895+00:00"};
}