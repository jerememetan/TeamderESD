import { useEffect, useMemo, useState } from "react";
import { fetchEnrollmentsBySectionId } from "../../../../services/enrollmentService";
import { fetchCourseByCode } from "../../../../services/courseService";
import { getSectionById } from "../../../../services/sectionService";
import {
  buildSectionRoster,
  fetchAllStudents,
} from "../../../../services/studentService";
import { generateTeamsForSection } from "../../../../services/teamFormationService";
import { fetchTeamsBySection } from "../../../../services/teamService";
import {
  decideSwapReviewRequest,
  fetchSwapReviewRequests,
} from "../../../../services/swapRequestService";
import {
  mapBackendTeamsToViewModel,
  swapMembersAcrossTeams,
} from "./teamLogic";

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
  const [isSwapRequestsLoading, setIsSwapRequestsLoading] = useState(false);
  const [isSwapDecisionUpdating, setIsSwapDecisionUpdating] = useState(false);
  const [rosterError, setRosterError] = useState("");
  const [teamError, setTeamError] = useState("");
  const [teamMessage, setTeamMessage] = useState("");
  const [swapMode, setSwapMode] = useState(false);
  const [selectedSwapMember, setSelectedSwapMember] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);

  const visibleSwapRequests = useMemo(
    () => swapRequestList,
    [swapRequestList],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadSwapRequests() {
      if (!backendSectionId) {
        setSwapRequestList([]);
        return;
      }

      setIsSwapRequestsLoading(true);
      try {
        const payload = await fetchSwapReviewRequests({ sectionId: backendSectionId });
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

  const pendingRequestMap = useMemo(() => {
    const pendingRows = visibleSwapRequests.filter(
      (request) => request.status === "pending",
    );
    return Object.fromEntries(
      pendingRows.map((request) => [String(request.studentId), request]),
    );
  }, [visibleSwapRequests]);

  const handleApprove = async (requestId) => {
    setIsSwapDecisionUpdating(true);
    try {
      await decideSwapReviewRequest({
        swapRequestId: requestId,
        decision: "APPROVED",
      });
      setSwapRequestList((currentRequests) =>
        currentRequests.map((request) =>
          request.id === requestId ? { ...request, status: "approved" } : request,
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
          request.id === requestId ? { ...request, status: "rejected" } : request,
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
    console.log("TEAM",team)
    console.log("MEMMBER", member)
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
      `Swap completed: ${selectedSwapMember.member.name} and ${member.name}.`,
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
    pendingRequestMap,
    swapMode,
    selectedSwapMember,
    selectedRequest,
    isSwapRequestsLoading,
    isSwapDecisionUpdating,
    isGeneratingTeams,
    setSelectedTeamId,
    setSelectedRequest,
    handleApprove,
    handleReject,
    handleGenerateTeams,
    handleToggleSwapMode,
    handleCancelSelection,
    handleMemberSwapClick,
  };
}
