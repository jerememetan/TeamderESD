import { useEffect, useMemo, useState } from "react";
import { fetchEnrollmentsBySectionId } from "../../../../services/enrollmentService";
import { fetchCourseByCode } from "../../../../services/courseService";
import { getSectionById } from "../../../../services/sectionService";
import {
  buildSectionRoster,
  fetchAllStudents,
} from "../../../../services/studentService";
import { generateTeamsForSection } from "../../../../services/teamFormationService";
import {
  fetchTeamsBySection,
  saveTeamsForSection,
} from "../../../../services/teamService";
import {
  confirmSectionSwaps,
  decideSwapReviewRequest,
  fetchSwapReviewRequests,
} from "../../../../services/swapRequestService";
import {
  mapBackendTeamsToViewModel,
  swapMembersAcrossTeams,
} from "./teamLogic";

function buildTeamAssignmentSignature(teams) {
  if (!Array.isArray(teams) || teams.length === 0) {
    return "";
  }

  return teams
    .map((team) => {
      const teamId = String(team?.id || "");
      const memberIds = Array.isArray(team?.members)
        ? team.members
            .map((member) => String(member?.id || ""))
            .filter(Boolean)
            .sort()
        : [];
      return `${teamId}:${memberIds.join(",")}`;
    })
    .sort()
    .join("|");
}

export function useTeamsPage(courseId, backendSectionId) {
  const [isCourseLoading, setIsCourseLoading] = useState(true);
  const [courseLoadError, setCourseLoadError] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [swapRequestList, setSwapRequestList] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [backendStudents, setBackendStudents] = useState([]);
  const [backendTeams, setBackendTeams] = useState([]);
  const [editableTeams, setEditableTeams] = useState([]);
  const [isRosterLoading, setIsRosterLoading] = useState(true);
  const [isTeamsLoading, setIsTeamsLoading] = useState(true);
  const [isGeneratingTeams, setIsGeneratingTeams] = useState(false);
  const [isSavingTeams, setIsSavingTeams] = useState(false);
  const [isSwapRequestsLoading, setIsSwapRequestsLoading] = useState(false);
  const [isSwapDecisionUpdating, setIsSwapDecisionUpdating] = useState(false);
  const [isConfirmingSwaps, setIsConfirmingSwaps] = useState(false);
  const [rosterError, setRosterError] = useState("");
  const [teamError, setTeamError] = useState("");
  const [teamMessage, setTeamMessage] = useState("");
  const [swapMode, setSwapMode] = useState(false);
  const [selectedSwapMember, setSelectedSwapMember] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);

  const visibleSwapRequests = useMemo(() => swapRequestList, [swapRequestList]);

  useEffect(() => {
    let isMounted = true;

    async function loadSwapRequests() {
      if (!backendSectionId) {
        setSwapRequestList([]);
        return;
      }

      setIsSwapRequestsLoading(true);
      try {
        const payload = await fetchSwapReviewRequests({
          sectionId: backendSectionId,
        });
        if (!isMounted) {
          return;
        }

        const rows = Array.isArray(payload?.requests) ? payload.requests : [];
        const normalizedRows = rows.map((row) => ({
          ...row,
          id: String(row?.id || ""),
          studentId: String(row?.studentId ?? ""),
          status: String(row?.status || "pending").toLowerCase(),
        }));

        setSwapRequestList(normalizedRows);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setSwapRequestList([]);
        setTeamError(error?.message || "Unable to load swap requests.");
      } finally {
        if (isMounted) {
          setIsSwapRequestsLoading(false);
        }
      }
    }

    loadSwapRequests();
    return () => {
      isMounted = false;
    };
  }, [backendSectionId]);

  useEffect(() => {
    let isMounted = true;

    async function fetchCourseAndSection() {
      setIsCourseLoading(true);
      setCourseLoadError("");

      try {
        const [course, section] = await Promise.all([
          fetchCourseByCode(courseId),
          backendSectionId
            ? getSectionById(backendSectionId)
            : Promise.resolve(null),
        ]);

        if (!isMounted) {
          return;
        }

        setSelectedCourse(course);
        setSelectedGroup(section);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setCourseLoadError(
          error?.message || "Unable to load course information.",
        );
      } finally {
        if (isMounted) {
          setIsCourseLoading(false);
        }
      }
    }

    fetchCourseAndSection();
    return () => {
      isMounted = false;
    };
  }, [courseId, backendSectionId]);

  useEffect(() => {
    let isMounted = true;

    async function loadRoster() {
      if (!backendSectionId) {
        setIsRosterLoading(false);
        setRosterError("Missing backend section mapping for this group.");
        return;
      }

      setIsRosterLoading(true);
      setRosterError("");

      try {
        const [enrollments, students] = await Promise.all([
          fetchEnrollmentsBySectionId(backendSectionId),
          fetchAllStudents(),
        ]);
        if (isMounted) {
          setBackendStudents(buildSectionRoster(enrollments, students));
        }
      } catch (error) {
        if (isMounted) {
          setRosterError(error.message);
          setBackendStudents([]);
        }
      } finally {
        if (isMounted) {
          setIsRosterLoading(false);
        }
      }
    }

    loadRoster();
    return () => {
      isMounted = false;
    };
  }, [backendSectionId]);

  useEffect(() => {
    let isMounted = true;

    async function loadTeams() {
      if (!backendSectionId) {
        setIsTeamsLoading(false);
        setTeamError("Missing backend section mapping for this group.");
        return;
      }

      setIsTeamsLoading(true);
      setTeamError("");
      setTeamMessage("");

      try {
        const teams = await fetchTeamsBySection(backendSectionId);
        if (!isMounted) {
          return;
        }
        setBackendTeams(teams);
        if (!teams.length) {
          setTeamMessage(
            "No backend teams saved for this section yet. Showing mock teams until you generate them.",
          );
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setTeamError(error.message);
        setBackendTeams([]);
      } finally {
        if (isMounted) {
          setIsTeamsLoading(false);
        }
      }
    }

    loadTeams();
    return () => {
      isMounted = false;
    };
  }, [backendSectionId]);

  const rosterById = useMemo(
    () =>
      new Map(backendStudents.map((student) => [student.student_id, student])),
    [backendStudents],
  );

  const backendVisibleTeams = useMemo(
    () =>
      mapBackendTeamsToViewModel(
        backendTeams,
        rosterById,
        courseId,
        backendSectionId,
      ),
    [backendTeams, rosterById, courseId, backendSectionId],
  );

  const teamDataSource = backendVisibleTeams.length ? "backend" : "mock";

  const backendTeamSignature = useMemo(
    () => buildTeamAssignmentSignature(backendVisibleTeams),
    [backendVisibleTeams],
  );

  const editableTeamSignature = useMemo(
    () => buildTeamAssignmentSignature(editableTeams),
    [editableTeams],
  );

  const hasLocalTeamEdits =
    backendTeamSignature.length > 0 &&
    editableTeamSignature.length > 0 &&
    backendTeamSignature !== editableTeamSignature;

  useEffect(() => {
    setEditableTeams(backendVisibleTeams);
    setSelectedSwapMember(null);
    setSwapMode(false);
  }, [backendVisibleTeams]);

  useEffect(() => {
    if (!editableTeams.length) {
      setSelectedTeamId(null);
      return;
    }

    if (!editableTeams.some((team) => team.id === selectedTeamId)) {
      setSelectedTeamId(editableTeams[0]?.id ?? null);
    }
  }, [editableTeams, selectedTeamId]);

  const visibleTeams = editableTeams;
  const selectedTeam =
    visibleTeams.find((team) => team.id === selectedTeamId) ||
    visibleTeams[0] ||
    null;

  const swapRequestMap = useMemo(() => {
    const requestRows = visibleSwapRequests.filter(
      (request) =>
        request.status === "pending" || request.status === "approved",
    );
    return Object.fromEntries(
      requestRows.map((request) => [String(request.studentId), request]),
    );
  }, [visibleSwapRequests]);

  const pendingSwapCount = useMemo(
    () =>
      visibleSwapRequests.filter((request) => request.status === "pending")
        .length,
    [visibleSwapRequests],
  );

  const approvedSwapCount = useMemo(
    () =>
      visibleSwapRequests.filter((request) => request.status === "approved")
        .length,
    [visibleSwapRequests],
  );

  const sectionStage = String(selectedGroup?.stage || "").toLowerCase();
  const isSectionFinalized =
    sectionStage === "confirmed" || sectionStage === "completed";
  const hasPendingSwapRequests = pendingSwapCount > 0;
  const canConfirmSwaps =
    Boolean(backendSectionId) &&
    !isSectionFinalized &&
    !hasPendingSwapRequests &&
    !isSwapRequestsLoading;

  const canSaveManualSwaps =
    Boolean(backendSectionId) &&
    teamDataSource === "backend" &&
    !isSectionFinalized &&
    hasLocalTeamEdits &&
    !isSavingTeams;

  const handleApprove = async (requestId) => {
    setIsSwapDecisionUpdating(true);
    try {
      await decideSwapReviewRequest({
        swapRequestId: requestId,
        decision: "APPROVED",
      });
      setSwapRequestList((currentRequests) =>
        currentRequests.map((request) =>
          request.id === requestId
            ? { ...request, status: "approved" }
            : request,
        ),
      );
      setSelectedRequest((currentRequest) =>
        currentRequest?.id === requestId
          ? { ...currentRequest, status: "approved" }
          : currentRequest,
      );
    } catch (error) {
      setTeamError(error?.message || "Unable to approve swap request.");
    } finally {
      setIsSwapDecisionUpdating(false);
    }
  };

  const handleReject = async (requestId) => {
    setIsSwapDecisionUpdating(true);
    try {
      await decideSwapReviewRequest({
        swapRequestId: requestId,
        decision: "REJECTED",
      });
      setSwapRequestList((currentRequests) =>
        currentRequests.map((request) =>
          request.id === requestId
            ? { ...request, status: "rejected" }
            : request,
        ),
      );
      setSelectedRequest((currentRequest) =>
        currentRequest?.id === requestId
          ? { ...currentRequest, status: "rejected" }
          : currentRequest,
      );
    } catch (error) {
      setTeamError(error?.message || "Unable to reject swap request.");
    } finally {
      setIsSwapDecisionUpdating(false);
    }
  };

  const handleGenerateTeams = async () => {
    if (!backendSectionId) {
      setTeamError("Missing backend section mapping for this group.");
      return;
    }

    setIsGeneratingTeams(true);
    setTeamError("");
    setTeamMessage("");

    try {
      const generatedTeams = await generateTeamsForSection(backendSectionId);
      setBackendTeams(generatedTeams);
      setTeamMessage("Backend teams generated and persisted successfully.");
    } catch (error) {
      setTeamError(error.message);
    } finally {
      setIsGeneratingTeams(false);
    }
  };

  const handleConfirmSwaps = async () => {
    if (!backendSectionId || !canConfirmSwaps || isConfirmingSwaps) {
      return;
    }

    setIsConfirmingSwaps(true);
    setTeamError("");

    try {
      const result = await confirmSectionSwaps({ sectionId: backendSectionId });

      const [swapPayload, refreshedTeams, refreshedSection] = await Promise.all(
        [
          fetchSwapReviewRequests({
            sectionId: backendSectionId,
          }),
          fetchTeamsBySection(backendSectionId),
          getSectionById(backendSectionId),
        ],
      );

      const rows = Array.isArray(swapPayload?.requests)
        ? swapPayload.requests
        : [];
      const normalizedRows = rows.map((row) => ({
        ...row,
        id: String(row?.id || ""),
        studentId: String(row?.studentId ?? ""),
        status: String(row?.status || "pending").toLowerCase(),
      }));

      setSwapRequestList(normalizedRows);
      setBackendTeams(refreshedTeams);
      setSelectedGroup(refreshedSection);
      setSelectedRequest(null);

      const executedCount = Number(
        result?.executed_count ?? result?.executedCount ?? 0,
      );
      const failedCount = Number(
        result?.failed_count ?? result?.failedCount ?? 0,
      );
      const approvedCount = Number(
        result?.approved_request_count ?? result?.approvedRequestCount ?? 0,
      );
      const safeExecutedCount = Number.isFinite(executedCount)
        ? executedCount
        : 0;
      const safeFailedCount = Number.isFinite(failedCount) ? failedCount : 0;
      const safeApprovedCount = Number.isFinite(approvedCount)
        ? approvedCount
        : 0;

      if (
        safeApprovedCount > 0 &&
        safeExecutedCount === 0 &&
        safeFailedCount === 0
      ) {
        setTeamMessage(
          `Execute approved swaps completed with an unexpected summary (Approved: ${safeApprovedCount}, Executed: 0, Failed: 0). Refresh swap requests to verify statuses.`,
        );
      } else {
        setTeamMessage(
          `Execute approved swaps completed. Approved: ${safeApprovedCount}, Executed: ${safeExecutedCount}, Failed: ${safeFailedCount}.`,
        );
      }
    } catch (error) {
      setTeamError(
        error?.message || "Unable to confirm swaps for this section.",
      );
    } finally {
      setIsConfirmingSwaps(false);
    }
  };

  const handleSaveTeamsToDb = async () => {
    if (!canSaveManualSwaps) {
      return;
    }

    setIsSavingTeams(true);
    setTeamError("");

    try {
      await saveTeamsForSection({
        sectionId: backendSectionId,
        teams: editableTeams,
      });

      const refreshedTeams = await fetchTeamsBySection(backendSectionId);
      setBackendTeams(refreshedTeams);
      setSwapMode(false);
      setSelectedSwapMember(null);
      setTeamMessage("Manual swaps were saved to the team database.");
    } catch (error) {
      setTeamError(error?.message || "Unable to save manual swaps.");
    } finally {
      setIsSavingTeams(false);
    }
  };

  const handleToggleSwapMode = () => {
    setSwapMode((current) => {
      const next = !current;
      if (!next) {
        setSelectedSwapMember(null);
      }
      return next;
    });
  };

  const handleCancelSelection = () => {
    setSelectedSwapMember(null);
  };

  const handleMemberSwapClick = (team, member) => {
    if (!swapMode) {
      return;
    }

    if (!selectedSwapMember) {
      setSelectedSwapMember({ teamId: team.id, member });
      setTeamMessage(
        `Selected ${member.name}. Choose a student from another team to swap.`,
      );
      return;
    }

    if (
      selectedSwapMember.member.id === member.id &&
      selectedSwapMember.teamId === team.id
    ) {
      setSelectedSwapMember(null);
      setTeamMessage("Selection cleared.");
      return;
    }

    if (selectedSwapMember.teamId === team.id) {
      return;
    }

    setEditableTeams((currentTeams) =>
      swapMembersAcrossTeams(currentTeams, selectedSwapMember, {
        teamId: team.id,
        member,
      }),
    );
    setTeamMessage(
      `Preview swap ready: ${selectedSwapMember.member.name} and ${member.name}. Save to DB to persist this change.`,
    );
    setSelectedSwapMember(null);
  };

  return {
    isCourseLoading,
    courseLoadError,
    selectedCourse,
    selectedGroup,
    visibleSwapRequests,
    backendStudents,
    isRosterLoading,
    rosterError,
    isTeamsLoading,
    teamError,
    teamMessage,
    teamDataSource,
    backendVisibleTeams,
    visibleTeams,
    selectedTeam,
    swapRequestMap,
    swapMode,
    selectedSwapMember,
    selectedRequest,
    isSwapRequestsLoading,
    isSwapDecisionUpdating,
    isConfirmingSwaps,
    isGeneratingTeams,
    isSavingTeams,
    pendingSwapCount,
    approvedSwapCount,
    hasPendingSwapRequests,
    canConfirmSwaps,
    canSaveManualSwaps,
    hasLocalTeamEdits,
    setSelectedTeamId,
    setSelectedRequest,
    handleApprove,
    handleReject,
    handleConfirmSwaps,
    handleSaveTeamsToDb,
    handleGenerateTeams,
    handleToggleSwapMode,
    handleCancelSelection,
    handleMemberSwapClick,
  };
}
