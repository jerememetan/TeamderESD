import { useCallback, useEffect, useState } from "react";
import { fetchCourseByCode } from "../../../../services/courseService";
import { fetchEnrollmentsBySectionId } from "../../../../services/enrollmentService";
import { getSectionById } from "../../../../services/sectionService";
import { fetchTeamsBySection } from "../../../../services/teamService";
import {
  buildSectionRoster,
  fetchAllStudents,
} from "../../../../services/studentService";
import {
  getPeerEvaluationRoundForSection,
  getPeerEvaluationRound,
  startPeerEvaluationRound,
  closePeerEvaluationRound,
} from "../../../../services/peerEvaluationService";

export function usePeerEvalPage(courseId, sectionId) {
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [teams, setTeams] = useState([]);
  const [students, setStudents] = useState([]);
  const [activeRound, setActiveRound] = useState(null);
  const [closedResult, setClosedResult] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isInitiating, setIsInitiating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  // Load course, section, teams, students, and active round
  useEffect(() => {
    let isMounted = true;

    async function loadAll() {
      setIsLoading(true);
      setError("");

      try {
        // Load course
        if (courseId) {
          const course = await fetchCourseByCode(courseId);
          if (isMounted) setSelectedCourse(course);
        }

        // Load section
        if (sectionId) {
          const group = await getSectionById(sectionId);
          if (isMounted) setSelectedGroup(group);
        }

        // Load teams
        if (sectionId) {
          try {
            const sectionTeams = await fetchTeamsBySection(sectionId);
            if (isMounted) setTeams(sectionTeams || []);
          } catch {
            if (isMounted) setTeams([]);
          }
        }

        // Load students
        if (sectionId) {
          try {
            const [enrollments, allStudents] = await Promise.all([
              fetchEnrollmentsBySectionId(sectionId),
              fetchAllStudents(),
            ]);
            const sectionStudents = buildSectionRoster(enrollments, allStudents);
            if (isMounted) setStudents(sectionStudents || []);
          } catch {
            if (isMounted) setStudents([]);
          }
        }

        // Check for active round
        if (sectionId) {
          try {
            const round = await getPeerEvaluationRoundForSection(sectionId);
            if (isMounted) setActiveRound(round);
          } catch {
            if (isMounted) setActiveRound(null);
          }
        }
      } catch (err) {
        if (isMounted) setError(err.message || "Failed to load page data");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadAll();
    return () => { isMounted = false; };
  }, [courseId, sectionId]);

  // Initiate peer eval round
  const handleInitiate = useCallback(async (title, dueAt) => {
    if (!sectionId) return;
    setIsInitiating(true);
    setError("");
    setActionMessage("");

    try {
      const result = await startPeerEvaluationRound({
        sectionId,
        title,
        dueAt,
      });

      setActiveRound({
        id: result.round.round_id,
        sectionId: result.round.section_id,
        status: result.round.status,
        title: result.round.title,
        dueAt: result.round.due_at,
        startedAt: result.round.created_at,
      });

      const notif = result.notification_results || {};
      setActionMessage(
        `Round created. ${notif.sent || 0} emails sent, ${notif.failed || 0} failed, ${notif.skipped || 0} skipped.`
      );
    } catch (err) {
      setError(err.message || "Failed to initiate peer evaluation round");
    } finally {
      setIsInitiating(false);
    }
  }, [sectionId]);

  // Close peer eval round
  const handleClose = useCallback(async () => {
    if (!activeRound?.id) return;
    setIsClosing(true);
    setError("");
    setActionMessage("");

    try {
      const result = await closePeerEvaluationRound(activeRound.id);

      setClosedResult(result);
      setActiveRound({
        ...activeRound,
        status: "closed",
      });

      const repResults = result.reputation_update_results || {};
      setActionMessage(
        `Round closed. ${result.reputation_deltas?.length || 0} reputation deltas computed. ${repResults.updated || 0} updated, ${repResults.failed || 0} failed.`
      );
    } catch (err) {
      setError(err.message || "Failed to close peer evaluation round");
    } finally {
      setIsClosing(false);
    }
  }, [activeRound]);

  // Refresh round data
  const refreshRound = useCallback(async () => {
    if (!activeRound?.id) return;
    try {
      const updated = await getPeerEvaluationRound(activeRound.id);
      if (updated) setActiveRound(updated);
    } catch {
      // ignore
    }
  }, [activeRound]);

  const totalStudents = students.length;
  const totalTeams = teams.length;

  return {
    selectedCourse,
    selectedGroup,
    teams,
    students,
    activeRound,
    closedResult,
    totalStudents,
    totalTeams,
    isLoading,
    isInitiating,
    isClosing,
    error,
    actionMessage,
    handleInitiate,
    handleClose,
    refreshRound,
  };
}
