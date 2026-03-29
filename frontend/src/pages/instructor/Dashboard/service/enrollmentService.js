// Fetch all enrollments from the backend

// {
//   "code": 200,
//   "data": [
//     {
//       "section_id": "22222222-2222-2222-2222-222222222222",
//       "student_id": 24
//     },
//   }
export async function fetchAllEnrollments() {
  const res = await fetch("http://localhost:3005/enrollment");
  const json = await res.json();
  return json.data || [];
}
