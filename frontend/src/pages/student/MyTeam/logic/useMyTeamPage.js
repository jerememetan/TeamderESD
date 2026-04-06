import { useCallback, useEffect, useMemo, useState } from "react";
import { loadAssignmentsForStudent } from "../../logic/studentAssignmentLogic";
import { fetchSwapReviewRequests } from "../../../../services/swapRequestService";

export function useMyTeamPage(activeStudent, isLoadingStudents) {
  const [teamAssignments, setTeamAssignments] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapReason, setSwapReason] = useState("");
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
  const [assignmentSource, setAssignmentSource] = useState("loading");
  const [assignmentError, setAssignmentError] = useState("");
  const [mySwapRequests, setMySwapRequests] = useState([]);
  const [isLoadingSwapRequests, setIsLoadingSwapRequests] = useState(false);
  const [swapRequestError, setSwapRequestError] = useState("");
  const [swapRequestsVersion, setSwapRequestsVersion] = useState(0);

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

  const activeStudentBackendId = useMemo(
    () => Number(activeStudent?.backendStudentId),
    [activeStudent],
  );

  const assignedSectionIds = useMemo(() => {
    const ids = teamAssignments
      .map((team) => String(team.sectionId || team.groupId || ""))
      .filter(Boolean);
    return Array.from(new Set(ids));
  }, [teamAssignments]);

  const refreshSwapRequests = useCallback(async () => {
    if (
      !Number.isFinite(activeStudentBackendId) ||
      !assignedSectionIds.length
    ) {
      setMySwapRequests([]);
      return;
    }

    setIsLoadingSwapRequests(true);
    setSwapRequestError("");

    try {
      const sectionResults = await Promise.all(
        assignedSectionIds.map(async (sectionId) => {
          const payload = await fetchSwapReviewRequests({ sectionId });
          const requests = Array.isArray(payload?.requests)
            ? payload.requests
            : [];
          return requests.map((request) => ({
            ...request,
            id: String(request?.id || ""),
            studentId: String(request?.studentId ?? request?.student_id ?? ""),
            sectionId: String(
              request?.sectionId ?? request?.section_id ?? sectionId,
            ),
            status: String(request?.status || "pending").toLowerCase(),
          }));
        }),
      );

      const flattened = sectionResults.flat();
      const ownRequests = flattened.filter(
        (request) => Number(request.studentId) === activeStudentBackendId,
      );

      setMySwapRequests(ownRequests);
    } catch (error) {
      setMySwapRequests([]);
      setSwapRequestError(
        error?.message || "Unable to load your swap request status.",
      );
    } finally {
      setIsLoadingSwapRequests(false);
    }
  }, [activeStudentBackendId, assignedSectionIds]);

  useEffect(() => {
    refreshSwapRequests();
  }, [refreshSwapRequests, swapRequestsVersion]);

  const swapRequestBySection = useMemo(() => {
    const bySection = {};

    for (const request of mySwapRequests) {
      const key = String(request.sectionId || "");
      if (!key) {
        continue;
      }

      const existing = bySection[key];
      if (!existing) {
        bySection[key] = request;
        continue;
      }

      const existingId = Number(existing.id);
      const nextId = Number(request.id);
      if (
        Number.isFinite(nextId) &&
        (!Number.isFinite(existingId) || nextId > existingId)
      ) {
        bySection[key] = request;
      }
    }

    return bySection;
  }, [mySwapRequests]);

  const selectedTeamSwapRequest = useMemo(() => {
    const sectionKey = String(
      selectedTeam?.sectionId || selectedTeam?.groupId || "",
    );
    return swapRequestBySection[sectionKey] ?? null;
  }, [selectedTeam, swapRequestBySection]);

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
    mySwapRequests,
    swapRequestBySection,
    selectedTeamSwapRequest,
    isLoadingSwapRequests,
    swapRequestError,
    refreshSwapRequests: () => setSwapRequestsVersion((current) => current + 1),
  };
}
