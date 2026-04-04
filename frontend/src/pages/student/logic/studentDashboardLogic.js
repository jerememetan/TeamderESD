import { fetchStudentAssignments } from "../../../services/studentAssignmentService";
import { getPendingPeerEvaluations } from "../../../services/peerEvaluationService";

function getFriendlyErrorMessage(error, fallbackMessage) {
  return error?.message || fallbackMessage;
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
    const backendAssignments = await fetchStudentAssignments({ studentProfile });

    setTeamAssignments(backendAssignments);
    setAssignmentSource("backend");

    if (!backendAssignments.length) {
      setAssignmentError("The backend did not return any team assignments for this student.");
      setPendingPeerRounds([]);
      return;
    }

    await loadPendingPeerEvals(studentProfile, backendAssignments, setPendingPeerRounds);
  } catch (error) {
    setTeamAssignments([]);
    setAssignmentSource("error");
    setAssignmentError(getFriendlyErrorMessage(error, "Unable to connect to the backend team service."));
    setPendingPeerRounds([]);
  } finally {
    setIsLoadingAssignments(false);
  }
}

export async function loadFormsForStudent(studentProfile, teamAssignments, setAvailableForms, setFormError) {
  setFormError("");

  try {
    const backendStudentId = Number(studentProfile?.backendStudentId);
    if (!Number.isFinite(backendStudentId)) {
      throw new Error("Unable to resolve a backend student id for the selected student.");
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
    setFormError(getFriendlyErrorMessage(error, "Unable to load available forms for this student."));
  }
}

async function loadPendingPeerEvals(studentProfile, teams, setPendingPeerRounds) {
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
