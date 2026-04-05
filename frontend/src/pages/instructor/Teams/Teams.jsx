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
import styles from "./Teams.module.css";
import { Button } from "../../../components/ui/button";
import { useTeamsPage } from "./logic/useTeamsPage";

function Teams() {
  const { courseId, groupId: backendSectionId } = useParams();
  const {
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
  } = useTeamsPage(courseId, backendSectionId);

  if (isCourseLoading) {
    return (
      <div className={`${styles.page} ${motionStyles.motionPage}`}>
        <ModuleBlock
          eyebrow="Loading"
          title="Loading teams"
          metric="..."
          metricLabel="Fetching course and section data"
        >
          <p className={styles.sourceNote}>
            Preparing the teams workspace for this section.
          </p>
        </ModuleBlock>
      </div>
    );
  }

  if (courseLoadError) {
    return (
      <div className={`${styles.page} ${motionStyles.motionPage}`}>
        <ModuleBlock
          eyebrow="Load Error"
          title="Unable to load teams"
          accent="orange"
        >
          <p className={styles.rosterError}>
            {courseLoadError}.{" "}
            <Link to="/instructor/error-logs">Go to Error Logs</Link>
          </p>
        </ModuleBlock>
      </div>
    );
  }

  if (!selectedCourse) {
    return <div className={styles.notFound}>Course not found</div>;
  }

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
          <SystemTag hazard>
            {isSwapRequestsLoading
              ? ".."
              : visibleSwapRequests.filter(
                  (request) => request.status === "pending",
                ).length}{" "}
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
          metricLabel="Students from enrollment + student-service"
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
              Atomic roster load failed: {rosterError}.{" "}
              <Link to="/instructor/error-logs">Go to Error Logs</Link>
            </p>
          ) : null}
        </ModuleBlock>
      ) : null}

      {teamError ? (
        <p className={styles.rosterError}>
          Team load failed: {teamError}.{" "}
          <Link to="/instructor/error-logs">Go to Error Logs</Link>
        </p>
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
                disabled={
                  isGeneratingTeams || isTeamsLoading || !backendSectionId
                }
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
          <div className={styles.teamList}>
            {isTeamsLoading && !visibleTeams.length ? (
              <p className={styles.sourceNote}>
                Loading teams for this section...
              </p>
            ) : null}
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
                    {team.members.length} members
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
                        {pendingRequest ? (
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
                    disabled={isSwapDecisionUpdating}
                  >
                    <CheckCircle className={styles.actionIcon} /> Approve
                  </Button>
                  <Button
                    onClick={() => handleReject(selectedRequest.id)}
                    variant="warning"
                    size="sm"
                    className={motionStyles.pulseWarning}
                    disabled={isSwapDecisionUpdating}
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
