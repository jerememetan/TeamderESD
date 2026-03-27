// Fetch all enrollments from the backend
export async function fetchAllEnrollments() {
  const res = await fetch("http://localhost:3005/enrollment");
  const json = await res.json();
  return json.data || [];
}
