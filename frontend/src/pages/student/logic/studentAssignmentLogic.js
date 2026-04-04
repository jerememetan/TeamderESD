import { fetchStudentAssignments } from "../../../services/studentAssignmentService";
import { getPendingPeerEvaluations } from "../../../services/peerEvaluationService";

function getFriendlyErrorMessage(error, fallbackMessage) {
  return error?.message || fallbackMessage;
}

async function loadPendingPeerEvals(
  studentProfile,
  teams,
  setPendingPeerRounds,
) {
  try {
    const backendStudentId = Number(studentProfile?.backendStudentId);
    if (!Number.isFinite(backendStudentId)) {
      setPendingPeerRounds([]);
      return;
    }

    const sectionIds = new Set();
    for (const team of teams) {
      const sectionId = team.sectionId || team.groupId;
      if (sectionId) {
        sectionIds.add(sectionId);
      }
    }

    if (sectionIds.size === 0) {
      setPendingPeerRounds([]);
      return;
    }

    const pending = await getPendingPeerEvaluations({
      studentId: backendStudentId,
      sectionIds: Array.from(sectionIds),
    });

    setPendingPeerRounds(pending);
  } catch {
    setPendingPeerRounds([]);
  }
}

export async function loadAssignmentsForStudent(
  studentProfile,
  setTeamAssignments,
  setAssignmentSource,
  setPendingPeerRounds,
  setAssignmentError,
  setIsLoadingAssignments,
) {
  setIsLoadingAssignments(true);
  setAssignmentError("");

  try {
    const backendAssignments = await fetchStudentAssignments({
      studentProfile,
    });

    setTeamAssignments(backendAssignments);
    setAssignmentSource("backend");

    if (!backendAssignments.length) {
      setAssignmentError(
        "The backend did not return any team assignments for this student.",
      );
      setPendingPeerRounds([]);
      return;
    }

    await loadPendingPeerEvals(
      studentProfile,
      backendAssignments,
      setPendingPeerRounds,
    );
  } catch (error) {
    setTeamAssignments([]);
    setAssignmentSource("error");
    setAssignmentError(
      getFriendlyErrorMessage(
        error,
        "Unable to connect to the backend team service.",
      ),
    );
    setPendingPeerRounds([]);
  } finally {
    setIsLoadingAssignments(false);
  }
}
