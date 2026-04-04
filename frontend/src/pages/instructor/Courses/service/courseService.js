import { fetchEnrollmentsBySections } from "../../../../services/enrollmentService";
import { fetchAllCourses } from "../../../../services/courseService";
import { fetchAllSections } from "../../../../services/sectionService";
import { buildCourseBase, mergeCourseCounts } from "../logic/getCourseStats";
import { fetchTeamsBySections } from "../../../../services/teamService";

export async function fetchCoursesBase() {
  const [courseRes, sectionArr] = await Promise.all([
    fetchAllCourses(),
    fetchAllSections(),
  ]);

  const courses = buildCourseBase(courseRes, sectionArr);
  const sectionIds = Array.from(new Set(sectionArr.map((s) => s.id).filter(Boolean)));

  return { courses, sectionIds };
}

export async function hydrateCoursesStats(courseList, sectionIds = []) {
  const uniqueSectionIds = Array.from(new Set(sectionIds.filter(Boolean)));
  if (!uniqueSectionIds.length) {
    return mergeCourseCounts(courseList, {}, {});
  }

  const [enrollBySection, teamsBySection] = await Promise.allSettled([
    fetchEnrollmentsBySections(uniqueSectionIds),
    fetchTeamsBySections(uniqueSectionIds),
  ]);

  const safeEnrollBySection =
    enrollBySection.status === "fulfilled" ? enrollBySection.value : {};
  const safeTeamsBySection =
    teamsBySection.status === "fulfilled" ? teamsBySection.value : {};

  // enrollMap: section_id -> student count
  const enrollMap = Object.entries(safeEnrollBySection).reduce((acc, [sid, enrollments]) => {
    acc[sid] = Array.isArray(enrollments) ? enrollments.length : 0;
    return acc;
  }, {});

  const teamMap = Object.entries(safeTeamsBySection).reduce((acc, [sid, teams]) => {
    acc[sid] = Array.isArray(teams) ? teams.length : 0;
    return acc;
  }, {});

  return mergeCourseCounts(courseList, enrollMap, teamMap);
}

export async function fetchCourses() {
  const { courses, sectionIds } = await fetchCoursesBase();
  return hydrateCoursesStats(courses, sectionIds);
}
