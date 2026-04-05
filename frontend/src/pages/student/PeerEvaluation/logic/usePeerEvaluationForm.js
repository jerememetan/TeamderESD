import { useEffect, useMemo, useState } from "react";
import {
  getPendingPeerEvaluations,
  getPeerEvaluationRound,
  getPeerEvaluationSubmission,
  submitPeerEvaluation,
} from "../../../../services/peerEvaluationService";
import { fetchAllEnrollments } from "../../../../services/enrollmentService";
import { fetchTeamsBySection } from "../../../../services/teamService";
import {
  buildStudentMapByBackendId,
  fetchAllStudents,
} from "../../../../services/studentService";

export function usePeerEvaluationForm({
  roundId,
  activeStudent,
  isLoadingStudents,
}) {
  const chooserMode = !roundId;
  const [availableRounds, setAvailableRounds] = useState([]);
  const [roundsError, setRoundsError] = useState("");
  const [round, setRound] = useState(null);
  const [teams, setTeams] = useState([]);
  const [studentsByBackendId, setStudentsByBackendId] = useState(new Map());
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [responses, setResponses] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const currentBackendId = useMemo(
    () => activeStudent?.backendStudentId ?? null,
    [activeStudent],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadAll() {
      if (isLoadingStudents || !activeStudent) {
        return;
      }

      setIsLoading(true);
      setRoundsError("");
      setSubmitError("");

      try {
        if (chooserMode) {
          const backendStudentId = Number(activeStudent.backendStudentId);
          if (!Number.isFinite(backendStudentId)) {
            throw new Error(
              "Unable to resolve a backend student id for the selected student.",
            );
          }

          let allEnrollments = [];
          try {
            allEnrollments = await fetchAllEnrollments();
          } catch {
            allEnrollments = [];
          }
          if (!isMounted) {
            return;
          }

          const sectionIds = Array.from(
            new Set(
              allEnrollments
                .filter(
                  (row) =>
                    Number(row?.student_id ?? row?.studentId) === backendStudentId,
                )
                .map((row) =>
                  String(row?.section_id ?? row?.sectionId ?? "").trim(),
                )
                .filter(Boolean),
            ),
          );

          if (!sectionIds.length) {
            setAvailableRounds([]);
            return;
          }

          const pendingRounds = await getPendingPeerEvaluations({
            studentId: backendStudentId,
            sectionIds,
          });
          if (!isMounted) {
            return;
          }

          setAvailableRounds(
            pendingRounds.sort((left, right) => {
              const leftDate = left?.dueAt ? Date.parse(left.dueAt) : Infinity;
              const rightDate = right?.dueAt ? Date.parse(right.dueAt) : Infinity;
              return leftDate - rightDate;
            }),
          );
          setRound(null);
          setTeams([]);
          setExistingSubmission(null);
          setResponses({});
          return;
        }

        const fetchedRound = await getPeerEvaluationRound(roundId || "");
        if (!isMounted) {
          return;
        }
        setRound(fetchedRound);

        if (!fetchedRound?.sectionId) {
          return;
        }

        let sectionTeams = [];
        try {
          sectionTeams = await fetchTeamsBySection(fetchedRound.sectionId);
        } catch {
          sectionTeams = [];
        }
        if (!isMounted) {
          return;
        }
        setTeams(sectionTeams);

        let students = [];
        try {
          students = await fetchAllStudents();
        } catch {
          students = [];
        }
        if (!isMounted) {
          return;
        }
        setStudentsByBackendId(buildStudentMapByBackendId(students));

        if (currentBackendId) {
          const submission = await getPeerEvaluationSubmission(
            fetchedRound.id,
            currentBackendId,
          );
          if (isMounted) {
            setExistingSubmission(submission);
          }
        }
      } catch (error) {
        if (isMounted && chooserMode) {
          setAvailableRounds([]);
          setRoundsError(
            error?.message || "Unable to load peer evaluation rounds.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadAll();
    return () => {
      isMounted = false;
    };
  }, [
    activeStudent,
    chooserMode,
    currentBackendId,
    isLoadingStudents,
    roundId,
  ]);

  const myTeam = useMemo(() => {
    if (!currentBackendId) {
      return null;
    }

    return (
      teams.find((team) =>
        (team.students || []).some(
          (student) => student.student_id === currentBackendId,
        ),
      ) || null
    );
  }, [teams, currentBackendId]);

  const memberList = useMemo(() => {
    if (!myTeam) {
      return [];
    }

    return (myTeam.students || []).map((student) => {
      const studentRecord = studentsByBackendId.get(Number(student.student_id));
      return {
        id: String(student.student_id),
        name:
          String(studentRecord?.name || "").trim() ||
          `Student ${student.student_id}`,
        email: String(studentRecord?.email || "").trim() || "No email",
        studentId: `ID-${student.student_id}`,
      };
    });
  }, [myTeam, studentsByBackendId]);

  const teammates = useMemo(
    () => memberList.filter((member) => member.id !== String(currentBackendId)),
    [memberList, currentBackendId],
  );

  function updateResponse(memberId, field, value) {
    setResponses((current) => ({
      ...current,
      [memberId]: {
        ...current[memberId],
        [field]: value,
      },
    }));
  }

  async function submitResponses() {
    setIsSubmitting(true);
    setSubmitError("");

    const entries = teammates.map((member) => ({
      evaluateeId: parseInt(member.id, 10),
      rating: Number(responses[member.id]?.rating || 0),
      justification: responses[member.id]?.justification || "",
    }));

    if (entries.some((entry) => !entry.rating)) {
      setSubmitError("Please rate all teammates before submitting.");
      setIsSubmitting(false);
      return false;
    }

    try {
      await submitPeerEvaluation({
        roundId: round.id,
        evaluatorId: currentBackendId,
        teamId: myTeam.team_id,
        entries,
      });
      return true;
    } catch (error) {
      setSubmitError(
        error?.message || "Failed to submit evaluation. Please try again.",
      );
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    chooserMode,
    availableRounds,
    roundsError,
    round,
    currentBackendId,
    myTeam,
    memberList,
    teammates,
    existingSubmission,
    responses,
    isLoading,
    isSubmitting,
    submitError,
    updateResponse,
    submitResponses,
  };
}
