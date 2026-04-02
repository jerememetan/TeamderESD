import { fetchJson } from './httpClient';

const COURSE_URL = import.meta.env.VITE_COURSE_URL ?? "http://localhost:8000/courses";

export async function fetchAllCourses(){
const courseJson = await fetchJson(COURSE_URL);
  const courseArr = courseJson.data?.Courses || [];
  return courseArr;
}
export async function fetchCourseByCode(code){
const courseJson = await fetchJson(`${COURSE_URL}/${encodeURIComponent(code)}`);
  const courseArr = courseJson.data || [];
  return courseArr;
}
