import { fetchAllEnrollments } from "../../../../services/enrollmentService";
import { fetchAllCourses } from "../../../../services/courseService";
import { fetchAllSections } from "../../../../services/sectionService";
import { getCoursesStats } from "../logic/getCourseStats"
import { fetchTeamsBySection} from "../../../../services/teamService";

export async function fetchCourses() {
  const courseRes = await fetchAllCourses();
  const sectionArr = await fetchAllSections();
  const enrollments = await fetchAllEnrollments();

  // enrollMap: section_id -> student count
  const enrollMap = enrollments.reduce((acc, e) => {
    const sid = e.section_id ?? e.sectionId ?? (e.section && e.section.id);
    if (!sid) return acc;
    acc[sid] = (acc[sid] || 0) + 1;
    return acc;
  }, {});

  // unique section IDs
  const sectionIds = Array.from(new Set(sectionArr.map(s => s.id).filter(Boolean)));

  // chunked parallel fetching to avoid overloading the teams service
  const batchSize = 20; // adjust if needed
  const teamMap = {};
  for (let i = 0; i < sectionIds.length; i += batchSize) {
    const batch = sectionIds.slice(i, i + batchSize);
    const promises = batch.map(id =>
      fetchTeamsBySection(id)
        .then(teams => [id, Array.isArray(teams) ? teams.length : 0])
        .catch(() => [id, 0])
    );
    const results = await Promise.all(promises);
    results.forEach(([id, count]) => {
      teamMap[id] = count;
    });
  }

  const formMap = {}; // keep using mockForms or fetch summaries later

  return getCoursesStats(courseRes, sectionArr, enrollMap, teamMap, formMap);
}