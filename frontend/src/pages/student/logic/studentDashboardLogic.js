import { fetchStudentAssignments } from "../../../services/studentAssignmentService";
import { getPendingPeerEvaluations } from "../../../services/peerEvaluationService";
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
      const groupIds = new Set(backendAssignments.map((team) => team.groupId));
      setPendingPeerRounds(
        getPendingPeerEvaluations({
          studentEmail: studentProfile.email,
          groupIds,
        }),
      );
    } else {
      setTeamAssignments(activeStudentTeams);
      setAssignmentSource("mock");
      const groupIds = new Set(activeStudentTeams.map((team) => team.groupId));
      setPendingPeerRounds(
        getPendingPeerEvaluations({
          studentEmail: studentProfile.email,
          groupIds,
        }),
      );
    }
  } catch (error) {
    setTeamAssignments(activeStudentTeams);
    setAssignmentSource("mock");
    setAssignmentError(error.message);
    const groupIds = new Set(activeStudentTeams.map((team) => team.groupId));
    setPendingPeerRounds(
      getPendingPeerEvaluations({
        studentEmail: studentProfile.email,
        groupIds,
      }),
    );
  } finally {
    setIsLoadingAssignments(false);
  }
}
