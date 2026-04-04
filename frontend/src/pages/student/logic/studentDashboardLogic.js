import { fetchStudentAssignments } from "../../../services/studentAssignmentService";
import { getPendingPeerEvaluations } from "../../../services/peerEvaluationService";
import { getBackendSectionId, getBackendStudentId } from "../../../data/backendIds";
import { mockCourses } from "../../../data/mockData";

export async function loadAssignmentsForStudent(
  studentProfile,
  activeStudentTeams,
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
      currentStudentId: studentProfile.id,
      courses: mockCourses,
    });

    if (backendAssignments.length) {
      setTeamAssignments(backendAssignments);
      setAssignmentSource("backend");
      await loadPendingPeerEvals(studentProfile, backendAssignments, setPendingPeerRounds);
    } else {
      setTeamAssignments(activeStudentTeams);
      setAssignmentSource("mock");
      await loadPendingPeerEvals(studentProfile, activeStudentTeams, setPendingPeerRounds);
    }
  } catch (error) {
    setTeamAssignments(activeStudentTeams);
    setAssignmentSource("mock");
    setAssignmentError(error.message);
    await loadPendingPeerEvals(studentProfile, activeStudentTeams, setPendingPeerRounds);
  } finally {
    setIsLoadingAssignments(false);
  }
}

async function loadPendingPeerEvals(studentProfile, teams, setPendingPeerRounds) {
  try {
    // Get the backend student ID
    const backendStudentId = getBackendStudentId(studentProfile.id);

    // Collect unique section IDs from team assignments
    const sectionIds = new Set();
    for (const team of teams) {
      const sectionId = getBackendSectionId(team.groupId);
      if (sectionId) {
        sectionIds.add(sectionId);
      }
    }

    if (!backendStudentId || sectionIds.size === 0) {
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
