import { useEffect, useState } from "react";
import { normalizeCourseList } from "../../../../adapters/courseAdapter";
import { generateTeamsForSection } from "../../../../services/teamFormationService";
import {
  fetchCoursesBase,
  hydrateCoursesStats,
} from "../service/courseService";

export function useCoursesPage() {
  const [courseList, setCourseList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [endingSectionId, setEndingSectionId] = useState(null);
  const [formingSectionIds, setFormingSectionIds] = useState(new Set());

  async function refreshCoursesAfterAction() {
    try {
      const { courses, sectionIds } = await fetchCoursesBase();
      const hydratedCourses = await hydrateCoursesStats(courses, sectionIds);
      setCourseList(normalizeCourseList(hydratedCourses));
    } catch {
      setLoadError(
        "Unable to refresh course data after action. Open Error Logs to inspect downstream failures.",
      );
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadCourses() {
      try {
        setLoadError("");
        const { courses, sectionIds } = await fetchCoursesBase();
        if (!isMounted) {
          return;
        }

        setCourseList(normalizeCourseList(courses));
        setLoading(false);
        setStatsLoading(true);

        const hydratedCourses = await hydrateCoursesStats(courses, sectionIds);
        if (!isMounted) {
          return;
        }

        setCourseList(normalizeCourseList(hydratedCourses));
      } catch {
        if (!isMounted) {
          return;
        }
        setCourseList([]);
        setLoading(false);
        setLoadError(
          "Unable to load instructor courses. Open Error Logs to inspect downstream failures.",
        );
      } finally {
        if (isMounted) {
          setStatsLoading(false);
        }
      }
    }

    loadCourses();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleEndCollection(_courseCode, group) {
    const sectionId = group?.id;
    if (!sectionId || endingSectionId) {
      return;
    }

    setEndingSectionId(sectionId);
    setFormingSectionIds((current) => new Set(current).add(sectionId));
    setLoadError("");

    try {
      await generateTeamsForSection(sectionId);
      await refreshCoursesAfterAction();
    } catch (error) {
      setLoadError(
        `Unable to end form collection for ${group.code}. ${error?.message || "Unknown error"}`,
      );
    } finally {
      setEndingSectionId(null);
      setFormingSectionIds((current) => {
        const next = new Set(current);
        next.delete(sectionId);
        return next;
      });
    }
  }

  return {
    courseList,
    loading,
    statsLoading,
    loadError,
    endingSectionId,
    formingSectionIds,
    handleEndCollection,
  };
}
