import { useEffect, useState } from "react";
import { fetchStudentForms } from "../../../../services/studentFormService";
import { fetchTeamsBySections } from "../../../../services/teamService";
import { getActivePeerEvaluationRoundsBySections } from "../../../../services/peerEvaluationService";
import { fetchAllEnrollments } from "../../../../services/enrollmentService";
import { loadAssignmentsForStudent } from "../../logic/studentAssignmentLogic";
function getFriendlyErrorMessage(error, fallbackMessage) {
  return error?.message || fallbackMessage;
}

export async function loadFormsForStudent(
  studentProfile,
  teamAssignments,
  setAvailableForms,
  setFormError,
) {
  setFormError("");

  try {
    const backendStudentId = Number(studentProfile?.backendStudentId);
    if (!Number.isFinite(backendStudentId)) {
      throw new Error(
        "Unable to resolve a backend student id for the selected student.",
      );
    }

    const availableForms = teamAssignments
      .filter((assignment) => Boolean(assignment?.sectionId))
      .map((assignment) => ({
        id: String(assignment.sectionId),
        sectionId: assignment.sectionId,
        studentId: backendStudentId,
        submitted: false,
        raw: assignment,
        courseId: assignment.courseId || "",
        courseCode: assignment.courseCode || "",
        courseName: assignment.courseName || "",
        sectionNumber: assignment.sectionNumber || null,
        title: `${assignment.courseCode || assignment.courseId || "Course"} Section ${assignment.sectionNumber || assignment.groupCode || assignment.sectionId}`,
        description: "Open form entry",
      }));

    setAvailableForms(availableForms);
  } catch (error) {
    setAvailableForms([]);
    setFormError(
      getFriendlyErrorMessage(
        error,
        "Unable to load available forms for this student.",
      ),
    );
  }
}

export async function loadDashboardSummary(studentProfile) {
  const backendStudentId = Number(studentProfile?.backendStudentId);
  if (!Number.isFinite(backendStudentId)) {
    throw new Error(
      "Unable to resolve a backend student id for the selected student.",
    );
  }

  // preload enrollment mapping to limit sections to those the student is actually enrolled in
  const allEnrollments = await fetchAllEnrollments();
  const enrollmentMap = allEnrollments.reduce((acc, rec) => {
    const sid = rec?.student_id ?? rec?.studentId ?? rec?.studentIdRaw;
    const sectionId = rec?.section_id ?? rec?.sectionId ?? rec?.section;
    if (!sid || !sectionId) return acc;
    const key = Number(sid);
    if (!acc.has(key)) acc.set(key, new Set());
    acc.get(key).add(String(sectionId));
    return acc;
  }, new Map());

  const forms = await fetchStudentForms({ studentId: backendStudentId });
  const unsubmittedForms = forms.filter((form) => !form.submitted);
  const uniqueSectionIds = Array.from(
    new Set(unsubmittedForms.map((form) => form.sectionId).filter(Boolean)),
  );

  // Prefer enrollment-derived sections for team and peer-eval lookups.
  // Student form rows can be stale/incomplete and should not drive section scope.
  const enrolledSectionSet = enrollmentMap.get(backendStudentId) || null;
  const enrolledSectionIds = enrolledSectionSet
    ? Array.from(enrolledSectionSet)
    : [];

  // Fall back to form-derived sections only when enrollment map has no rows.
  const filteredSectionIds =
    enrolledSectionIds.length > 0 ? enrolledSectionIds : uniqueSectionIds;

  if (!filteredSectionIds.length) {
    return {
      teamCount: 0,
      formCount: unsubmittedForms.length,
      peerEvalCount: 0,
      availableForms: unsubmittedForms,
      nextPeerRound: null,
    };
  }

  const [teamsBySection, roundsBySection] = await Promise.all([
    fetchTeamsBySections(filteredSectionIds),
    getActivePeerEvaluationRoundsBySections(filteredSectionIds),
  ]);

  const teamCount = filteredSectionIds.reduce((count, sectionId) => {
    const sectionTeams = Array.isArray(teamsBySection[sectionId])
      ? teamsBySection[sectionId]
      : [];
    const hasMembership = sectionTeams.some((team) =>
      (team?.students ?? []).some(
        (student) => Number(student?.student_id) === backendStudentId,
      ),
    );

    return hasMembership ? count + 1 : count;
  }, 0);

  const activeRounds = filteredSectionIds.flatMap((sectionId) =>
    Array.isArray(roundsBySection[sectionId]) ? roundsBySection[sectionId] : [],
  );

  return {
    teamCount,
    formCount: unsubmittedForms.length,
    peerEvalCount: activeRounds.length,
    availableForms: unsubmittedForms,
    nextPeerRound: activeRounds[0] || null,
  };
}

export function useDashboardSummary(studentProfile) {
  const [teamCount, setTeamCount] = useState(0);
  const [peerEvalCount, setPeerEvalCount] = useState(0);
  const [nextPeerRound, setNextPeerRound] = useState(null);
  const [availableForms, setAvailableForms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studentProfile) {
      setTeamCount(0);
      setPeerEvalCount(0);
      setNextPeerRound(null);
      setAvailableForms([]);
      setIsLoading(true);
      setError("");
      return;
    }

    let ignore = false;

    async function doLoad() {
      setIsLoading(true);
      setError("");

      try {
        const summary = await loadDashboardSummary(studentProfile);
        if (ignore) return;

        setTeamCount(summary.teamCount);
        setPeerEvalCount(summary.peerEvalCount);
        setNextPeerRound(summary.nextPeerRound);
        setAvailableForms(summary.availableForms || []);
      } catch (err) {
        if (ignore) return;
        setTeamCount(0);
        setPeerEvalCount(0);
        setNextPeerRound(null);
        setAvailableForms([]);
        setError(
          err?.message || "Unable to load dashboard metrics from the backend.",
        );
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    doLoad();

    return () => {
      ignore = true;
    };
  }, [studentProfile]);

  return {
    teamCount,
    peerEvalCount,
    nextPeerRound,
    availableForms,
    isLoading,
    error,
  };
}

export { loadAssignmentsForStudent };
