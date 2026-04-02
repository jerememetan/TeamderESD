import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  CheckCircle,
  Mail,
  RefreshCw,
  Users,
  XCircle,
} from "lucide-react";
import GroupChip from "../../../components/schematic/GroupChip";
import ModuleBlock from "../../../components/schematic/ModuleBlock";
import SystemTag from "../../../components/schematic/SystemTag";
import motionStyles from "../../../components/schematic/motion.module.css";
import { getBackendSectionId } from "../../../data/backendIds";
import {
  mockCourses,
  mockSwapRequests,
  mockTeams,
} from "../../../data/mockData";
import {
  getPeerEvaluationRoundForGroup,
  getPeerEvaluationSummary,
  startPeerEvaluationRound,
} from "../../../services/peerEvaluationService";
import { fetchStudentProfile } from "../../../services/studentProfileService";
import { generateTeamsForSection } from "../../../services/teamFormationService";
import { fetchTeamsBySection } from "../../../services/teamService";
import {
  mapBackendTeamsToViewModel,
  swapMembersAcrossTeams,
} from "./logic/teamLogic";
import styles from "./Teams.module.css";
import { Button } from "../../../components/ui/button";
import {fetchCourseByCode} from "../../../services/courseService";
import {getSectionById} from "../../../services/sectionService";

function Teams() {
  const { courseId, groupId: backendSectionId } = useParams();
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [swapRequestList, setSwapRequestList] = useState(mockSwapRequests);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [backendStudents, setBackendStudents] = useState([]);
  const [backendTeams, setBackendTeams] = useState([]);
  const [editableTeams, setEditableTeams] = useState([]);
  const [isRosterLoading, setIsRosterLoading] = useState(true);
  const [isTeamsLoading, setIsTeamsLoading] = useState(true);
  const [isGeneratingTeams, setIsGeneratingTeams] = useState(false);
  const [rosterError, setRosterError] = useState("");
  const [teamError, setTeamError] = useState("");
  const [teamMessage, setTeamMessage] = useState("");
  const [peerRound, setPeerRound] = useState(null);
  const [swapMode, setSwapMode] = useState(false);
  const [selectedSwapMember, setSelectedSwapMember] = useState(null);

  const [selectedCourse, setSelectedCourse] = useState(null);


  const [selectedGroup,setSelectedGroup] = useState(null);


  const mockVisibleTeams = mockTeams.filter(
    (team) =>
      team.courseId === courseId && (!backendSectionId || team.groupId === backendSectionId),
  );
  const visibleSwapRequests = swapRequestList.filter(
    (request) =>
      request.courseId === courseId &&
      (!backendSectionId || request.groupId === backendSectionId),
  );

  useEffect(() => {
    let isMounted = true;

    async function fetchCourseAndSection() {
      try {
        const [course, section] = await Promise.all([
          fetchCourseByCode(courseId),
          backendSectionId ? getSectionById(backendSectionId) : Promise.resolve(null),
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
        console.log("course or section not found:", courseId, backendSectionId, error);
      }
    }

    fetchCourseAndSection();
    return () => {
      isMounted = false;
    };
  }, [courseId, backendSectionId])

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
        const students = await fetchStudentProfile(backendSectionId);
        if (isMounted) {
          setBackendStudents(students);
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
      // checks if backend is present
      if (!backendSectionId) {
        setIsTeamsLoading(false);
        setTeamError("Missing backend section mapping for this group.");
        return;
      }
      // sets team initali

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

  useEffect(() => {
    if (!backendSectionId) {
      setPeerRound(null);
      return;
    }

    const round = getPeerEvaluationRoundForGroup(backendSectionId);
    setPeerRound(round ? getPeerEvaluationSummary(round.id) : null);
  }, [backendSectionId]);

  const rosterById = useMemo(
    () =>
      new Map(backendStudents.map((student) => [student.student_id, student])),
    [backendStudents],
  );

  const backendVisibleTeams = useMemo(
    () =>
      mapBackendTeamsToViewModel(backendTeams, rosterById, courseId, backendSectionId),
    [backendTeams, rosterById, courseId, backendSectionId],
  );

  const initialVisibleTeams = useMemo(
    () => (backendVisibleTeams.length ? backendVisibleTeams : mockVisibleTeams),
    [backendVisibleTeams, mockVisibleTeams],
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

  const pendingRequestMap = useMemo(
    () =>
      Object.fromEntries(
        visibleSwapRequests
          .filter((request) => request.status === "pending")
          .map((request) => [request.studentId, request]),
      ),
    [visibleSwapRequests],
  );

  if (!selectedCourse) {
    return <div className={styles.notFound}>Course not found</div>;
  }
  const handleApprove = (requestId) => {
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
  };

  const handleReject = (requestId) => {
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
  };

  const handleStartPeerEvaluation = () => {
    if (!selectedGroup) {
      return;
    }

    const round = startPeerEvaluationRound({
      courseId,
      groupId: selectedGroup.id,
      teamIds: visibleTeams.map((team) => team.id),
      eligibleStudentEmails: Array.from(
        new Set(
          visibleTeams
            .flatMap((team) => team.members.map((member) => member.email))
            .filter(Boolean),
        ),
      ),
    });

    setPeerRound(getPeerEvaluationSummary(round.id));
    setTeamMessage(`Peer evaluation round started for ${selectedCourse.code}.`);
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
      // TODO: PENDING FIX FROM JIN RAE (422 Error)
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
// TODO: ADD SWAP API THINGY IDK
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
      // 
    );
    setTeamMessage(
      `Swap completed: ${selectedSwapMember.member.name} and ${member.name}.`,
    );
    setSelectedSwapMember(null);
  };

  const heroTitle = selectedGroup
    ? `${selectedCourse.code} G${selectedGroup.section_number} teams`
    : `${selectedCourse.code} teams`;
  const heroSubtitle = selectedGroup
    ? `Review the teams for ${selectedCourse.code} G${selectedGroup.section_number}, compare them against the live section roster, and start the final peer evaluation round when the project is done.`
    : "See every team in this course, check whether students have confirmed, and review swap requests.";
  const backLink = "/instructor/courses";
  const rosterSourceTone = rosterError
    ? "alert"
    : backendStudents.length
      ? "success"
      : "neutral";
  const teamSourceTone = teamError
    ? "alert"
    : teamDataSource === "backend"
      ? "success"
      : "neutral";
  const yearCounts = backendStudents.reduce((accumulator, student) => {
    const key = student?.profile?.year ? `Y${student.profile.year}` : "Unknown";
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
  const genderCounts = backendStudents.reduce((accumulator, student) => {
    const key = student?.profile?.gender || "Unknown";
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <Link to={backLink} className={styles.backLink}>
        <ArrowLeft className={styles.backIcon} /> Return to course matrix
      </Link>

      <section className={styles.hero}>
        <div>
          <h2 className={styles.title}>{heroTitle}</h2>
          <p className={styles.subtitle}>{heroSubtitle}</p>
        </div>
        <div className={styles.heroTags}>
          <SystemTag tone={rosterSourceTone}>
            {isRosterLoading
              ? "Loading roster"
              : backendStudents.length
                ? "Live roster loaded"
                : "Roster unavailable"}
          </SystemTag>
          <SystemTag tone={teamSourceTone}>
            {isTeamsLoading
              ? "Loading teams"
              : teamDataSource === "backend"
                ? "Backend teams loaded"
                : "Mock teams active"}
          </SystemTag>
          {peerRound ? (
            <SystemTag tone="success">Peer evaluation active</SystemTag>
          ) : null}
          <SystemTag hazard>
            {
              visibleSwapRequests.filter(
                (request) => request.status === "pending",
              ).length
            }{" "}
            pending interventions
          </SystemTag>
        </div>
      </section>

      {selectedGroup ? (
        <ModuleBlock
          componentId="MOD-T0"
          eyebrow="Section Roster"
          title={`${selectedCourse.code} G${selectedGroup.section_number}`}
          metric={backendStudents.length}
          metricLabel="Students from student-profile"
          className={motionStyles.staggerItem}
          style={{ "--td-stagger-delay": "0ms" }}
        >
          <div className={styles.rosterSummary}>
            <div className={styles.rosterStat}>
              <Users className={styles.actionIcon} />
              <span>
                {Object.entries(yearCounts)
                  .map(([label, count]) => `${label} : ${count} Students`)
                  .join(" | ") || "No year data"}
              </span>
            </div>
            <div className={styles.rosterStat}>
              <span>
                {Object.entries(genderCounts)
                  .map(([label, count]) => `${label} ${count}`)
                  .join(" | ") || "No gender data"}
              </span>
            </div>
          </div>
          {rosterError ? (
            <p className={styles.rosterError}>
              Student-profile load failed: {rosterError}
            </p>
          ) : null}
        </ModuleBlock>
      ) : null}

      {teamError ? (
        <p className={styles.rosterError}>Team load failed: {teamError}</p>
      ) : null}
      {teamMessage ? <p className={styles.teamMessage}>{teamMessage}</p> : null}

      <div className={styles.layout}>
        <ModuleBlock
          componentId="MOD-T1"
          eyebrow="Teams"
          title={`Total Teams : ${visibleTeams.length}`}
          className={`${styles.sideModule} ${motionStyles.staggerItem}`}
          style={{ "--td-stagger-delay": "50ms" }}
          actions={
            <div className={styles.moduleActions}>
              <Button
                onClick={handleGenerateTeams}
                disabled={isGeneratingTeams || !backendSectionId}
                variant="success"
                size="sm"
              >
                <RefreshCw className={styles.actionIcon} />{" "}
                {isGeneratingTeams
                  ? "Generating..."
                  : backendVisibleTeams.length
                    ? "Regenerate teams"
                    : "Generate teams"}
              </Button>
              <Button
                onClick={handleToggleSwapMode}
                variant={swapMode ? "warning" : "outline"}
                size="sm"
              >
                {swapMode ? "Swap mode on" : "Swap mode"}
              </Button>
              {swapMode && selectedSwapMember ? (
                <Button
                  onClick={handleCancelSelection}
                  variant="outline"
                  size="sm"
                >
                  Cancel selection
                </Button>
              ) : null}
              <Button
                onClick={handleStartPeerEvaluation}
                disabled={
                  !selectedGroup || !visibleTeams.length || Boolean(peerRound)
                }
                variant="outline"
                size="sm"
              >
                Start peer evaluation
              </Button>
            </div>
          }
        >
          <p className={styles.sourceNote}>
            {teamDataSource === "backend"
              ? "Showing backend teams persisted by the team service."
              : "Showing fallback mock teams until backend teams are generated for this section."}
          </p>
          {swapMode ? (
            <p className={styles.sourceNote}>
              Swap mode is enabled. Pick one student, then pick a student from
              another team to exchange them.
            </p>
          ) : null}
          {peerRound ? (
            <p className={styles.sourceNote}>
              Peer evaluation round is active for this group.{" "}
              {peerRound.submissionCount} submitted :: {peerRound.pendingCount}{" "}
              pending.
            </p>
          ) : (
            <p className={styles.sourceNote}>
              Peer evaluation has not started for this group yet.
            </p>
          )}
          <div className={styles.teamList}>
            {visibleTeams.map((team, index) => {
              const hasPendingRequest = team.members.some(
                (member) => pendingRequestMap[member.id],
              );
              const isTeamConfirmed =
                team.source === "backend"
                  ? false
                  : team.members.every(
                      (member) => member.confirmationStatus === "confirmed",
                    );
              return (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                  className={`${styles.teamSelect} ${selectedTeam?.id === team.id ? styles.teamSelectActive : ""} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
                  style={{ "--td-stagger-delay": `${index * 50}ms` }}
                >
                  <div className={styles.teamSelectHeader}>
                    <p
                      className={`${styles.teamCode} ${isTeamConfirmed ? styles.teamCodeConfirmed : styles.teamCodePending}`}
                    >
                      {team.name}
                    </p>
                    {hasPendingRequest ? (
                      <SystemTag hazard>Pending swap</SystemTag>
                    ) : null}
                  </div>
                  <p className={styles.teamMeta}>
                    {team.groupId} :: {team.members.length} members
                  </p>
                  <SystemTag
                    tone={
                      team.source === "backend"
                        ? "neutral"
                        : isTeamConfirmed
                          ? "success"
                          : "alert"
                    }
                  >
                    {team.source === "backend"
                      ? "Generated from backend"
                      : isTeamConfirmed
                        ? "All members confirmed"
                        : "Waiting for confirmations"}
                  </SystemTag>
                </button>
              );
            })}
          </div>
        </ModuleBlock>

        <div className={styles.mainColumn}>
          {selectedTeam ? (
            <ModuleBlock
              componentId="MOD-T2"
              title={
                <span
                  className={
                    selectedTeam.source === "backend"
                      ? styles.teamCodeConfirmed
                      : selectedTeam.members.every(
                            (member) =>
                              member.confirmationStatus === "confirmed",
                          )
                        ? styles.teamCodeConfirmed
                        : styles.teamCodePending
                  }
                >
                  {selectedTeam.name}
                </span>
              }
              metric={selectedTeam.members.length}
              metricLabel="Members in this team"
              className={`${motionStyles.staggerItem}`}
              style={{ "--td-stagger-delay": "100ms" }}
            >
              <div className={styles.teamSummary}>
                <SystemTag
                  tone={
                    selectedTeam.source === "backend"
                      ? "neutral"
                      : selectedTeam.members.every(
                            (member) =>
                              member.confirmationStatus === "confirmed",
                          )
                        ? "success"
                        : "alert"
                  }
                >
                  {selectedTeam.source === "backend"
                    ? "Backend-generated team"
                    : selectedTeam.members.every(
                          (member) => member.confirmationStatus === "confirmed",
                        )
                      ? "Team confirmed"
                      : "Waiting for confirmations"}
                </SystemTag>
                {swapMode ? (
                  <SystemTag tone="alert">Swap mode enabled</SystemTag>
                ) : null}
              </div>
              <div className={styles.memberList}>
                {selectedTeam.members.map((member, index) => {
                  const pendingRequest = pendingRequestMap[member.id];
                  const isBackendMember = selectedTeam.source === "backend";
                  const isSelectedForSwap =
                    selectedSwapMember?.teamId === selectedTeam.id &&
                    selectedSwapMember?.member.id === member.id;

                  return (
                    <div
                      key={member.id}
                      role={swapMode ? "button" : undefined}
                      tabIndex={swapMode ? 0 : undefined}
                      onClick={() =>
                        handleMemberSwapClick(selectedTeam, member)
                      }
                      onKeyDown={(event) => {
                        if (!swapMode) {
                          return;
                        }
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleMemberSwapClick(selectedTeam, member);
                        }
                      }}
                      className={`${styles.memberCard} ${pendingRequest ? styles.memberCardAlert : ""} ${swapMode ? styles.memberCardInteractive : ""} ${isSelectedForSwap ? styles.memberCardSelected : ""} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
                      style={{ "--td-stagger-delay": `${index * 50}ms` }}
                    >
                      <div className={styles.memberIdentity}>
                        <div className={styles.memberAvatar}>
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <p
                            className={`${styles.memberName} ${isBackendMember ? styles.memberNameConfirmed : member.confirmationStatus === "confirmed" ? styles.memberNameConfirmed : styles.memberNamePending}`}
                          >
                            {member.name}
                          </p>
                          <p className={styles.memberMeta}>
                            {member.studentId}
                          </p>
                        </div>
                      </div>
                      <div className={styles.memberActions}>
                        {isSelectedForSwap ? (
                          <SystemTag tone="alert">Selected for swap</SystemTag>
                        ) : null}
                        <SystemTag
                          tone={
                            isBackendMember
                              ? "neutral"
                              : member.confirmationStatus === "confirmed"
                                ? "success"
                                : "alert"
                          }
                        >
                          {isBackendMember
                            ? "From backend roster"
                            : member.confirmationStatus === "confirmed"
                              ? "Confirmed"
                              : "Pending"}
                        </SystemTag>
                        <div className={styles.mailLine}>
                          <Mail className={styles.mailIcon} />{" "}
                          <span>{member.email}</span>
                        </div>
                        {!isBackendMember && pendingRequest ? (
                          <Button
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedRequest(pendingRequest);
                            }}
                            variant="warning"
                            size="sm"
                            className={motionStyles.pulseWarning}
                          >
                            See swap request
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ModuleBlock>
          ) : (
            <ModuleBlock
              componentId="MOD-T0A"
              eyebrow="Selection"
              title="No team selected"
              metric="00"
              metricLabel="Visible team members"
              className={motionStyles.staggerItem}
              style={{ "--td-stagger-delay": "100ms" }}
            />
          )}
        </div>
      </div>

      {selectedRequest ? (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalCard} ${motionStyles.motionPage}`}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalCode}>[SWAP REQUEST]</p>
                <h3 className={styles.modalTitle}>
                  {selectedRequest.studentName} from{" "}
                  {selectedRequest.currentTeamName}
                </h3>
              </div>
              {selectedRequest.status === "pending" ? (
                <SystemTag hazard>Pending review</SystemTag>
              ) : selectedRequest.status === "approved" ? (
                <SystemTag tone="success">Approved</SystemTag>
              ) : (
                <SystemTag tone="alert">Rejected</SystemTag>
              )}
            </div>
            <div className={styles.reasonBox}>
              <p className={styles.reasonLabel}>Reason</p>
              <p className={styles.reasonText}>{selectedRequest.reason}</p>
            </div>
            <div className={styles.modalActions}>
              {selectedRequest.status === "pending" ? (
                <>
                  <Button
                    onClick={() => handleApprove(selectedRequest.id)}
                    variant="success"
                    size="sm"
                  >
                    <CheckCircle className={styles.actionIcon} /> Approve
                  </Button>
                  <Button
                    onClick={() => handleReject(selectedRequest.id)}
                    variant="warning"
                    size="sm"
                    className={motionStyles.pulseWarning}
                  >
                    <XCircle className={styles.actionIcon} /> Reject
                  </Button>
                </>
              ) : null}
              <Button
                onClick={() => setSelectedRequest(null)}
                variant="outline"
                size="sm"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Teams;
