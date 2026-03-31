export async function fetchAllCourses(){
const courseRes = await fetch("http://127.0.0.1:3017/api/courses");
  const courseJson = await courseRes.json();
  const courseArr = courseJson.data?.Courses || [];
  return courseArr;
}
export async function fetchCourseByCode(code){
const courseRes = await fetch("http://127.0.0.1:3017/api/courses/" + code);
  const courseJson = await courseRes.json();
  const courseArr = courseJson.data || [];
  return courseArr;
}
