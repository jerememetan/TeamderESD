import { useEffect, useState } from "react";
import { fetchCourseByCode } from "../../../../services/courseService";
import { getSectionById } from "../../../../services/sectionService";
import { fetchAllStudents } from "../../../../services/studentService";
import {
  fetchSubmittedStudentFormsBySectionId,
  fetchUnsubmittedStudentFormsBySectionId,
} from "../../../../services/studentFormService";
import { buildCompletionStatus } from "./buildCompletionStatus";

const EMPTY_STATUS = {
  total: 0,
  submitted: [],
  notSubmitted: [],
  percentage: 0,
};

export function useCompletionStatus(courseId, groupId) {
  const [course, setCourse] = useState(null);
  const [group, setGroup] = useState(null);
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [nextCourse, nextGroup] = await Promise.all([
          fetchCourseByCode(courseId),
          getSectionById(groupId),
        ]);

        const [students, submittedForms, unsubmittedForms] = await Promise.all([
          fetchAllStudents(),
          fetchSubmittedStudentFormsBySectionId(groupId),
          fetchUnsubmittedStudentFormsBySectionId(groupId),
        ]);

        if (!isMounted) {
          return;
        }

        setCourse(nextCourse);
        setGroup(nextGroup);
        setStatus(
          buildCompletionStatus(submittedForms, unsubmittedForms, students),
        );
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(
          `Completion status load failed: ${loadError?.message || String(loadError)}`,
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [courseId, groupId]);

  return {
    course,
    group,
    status,
    loading,
    error,
  };
}
