// handles all enrollment related services
export async function fetchAllEnrollments() {
  const res = await fetch("http://localhost:3005/enrollment");
  const json = await res.json();
  return json.data || [];
}

export async function fetchEnrollmentsBySectionId(sectionId) {
  const res = await fetch(`http://localhost:3005/enrollment?section_id=${encodeURIComponent(sectionId)}`);
  const json = await res.json();
  return json.data || [];
}

export async function fetchEnrollmentCountBySectionId(sectionId) {
  const res = await fetch(`http://localhost:3005/enrollment?section_id=${encodeURIComponent(sectionId)}`);
  const json = await res.json();
  return json.data.length;
}