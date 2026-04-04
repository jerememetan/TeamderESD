import { useEffect, useMemo, useState } from "react";
import { loadAssignmentsForStudent } from "../../logic/studentAssignmentLogic";

export function useMyTeamPage(activeStudent, isLoadingStudents) {
  const [teamAssignments, setTeamAssignments] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapReason, setSwapReason] = useState("");
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
  const [assignmentSource, setAssignmentSource] = useState("loading");
  const [assignmentError, setAssignmentError] = useState("");

  useEffect(() => {
    if (isLoadingStudents || !activeStudent) {
      return;
    }

    loadAssignmentsForStudent(
      activeStudent,
      setTeamAssignments,
      setAssignmentSource,
      () => {},
      setAssignmentError,
      setIsLoadingAssignments,
    );
  }, [activeStudent, isLoadingStudents]);

  const selectedTeam = useMemo(
    () =>
      teamAssignments.find((team) => team.id === selectedTeamId) ||
      teamAssignments[0] ||
      null,
    [selectedTeamId, teamAssignments],
  );

  return {
    teamAssignments,
    selectedTeamId,
    setSelectedTeamId,
    selectedTeam,
    showSwapModal,
    setShowSwapModal,
    swapReason,
    setSwapReason,
    isLoadingAssignments,
    assignmentSource,
    assignmentError,
  };
}
