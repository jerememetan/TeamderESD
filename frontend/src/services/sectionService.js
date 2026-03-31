export async function fetchAllSections() {
  const sectionRes = await fetch("http://127.0.0.1:3018/section");
  const sectionJson = await sectionRes.json();
  return sectionJson.data || [];
}


export async function getSectionById(id){
  const sectionRes = await fetch("http://127.0.0.1:3018/section/" + id);
  const sectionJson = await sectionRes.json();
  return sectionJson.data || 
  {    "course_id": 1,
      "created_at": "2026-03-26T02:35:11.367895+00:00",
      "id": 12341235345,
      "is_active": true,
      "section_number": 1,
      "stage": "setup",
      "updated_at": "2026-03-26T02:35:11.367895+00:00"};
}