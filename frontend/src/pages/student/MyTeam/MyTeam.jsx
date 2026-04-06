import { Link, useNavigate, useParams } from "react-router";
import { AlertTriangle, ArrowLeft, Mail, RefreshCw } from "lucide-react";
import { useState } from "react";
import GroupChip from "../../../components/schematic/GroupChip";
import ModuleBlock from "../../../components/schematic/ModuleBlock";
import SystemTag from "../../../components/schematic/SystemTag";
import motionStyles from "../../../components/schematic/motion.module.css";
import StudentSwitcher from "../../../components/student/StudentSwitcher";
import { Button } from "../../../components/ui/button";
import { createSwapRequest } from "../../../services/swapRequestService";
import { useStudentSession } from "../../../services/studentSession";
import { useMyTeamPage } from "./logic/useMyTeamPage";
import styles from "./MyTeam.module.css";

function getSwapRequestMeta(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") {
    return { tone: "success", label: "Swap request approved" };
  }
  if (normalized === "rejected") {
    return { tone: "alert", label: "Swap request rejected" };
  }
  if (normalized === "executed") {
    return { tone: "success", label: "Swap executed" };
  }
  if (normalized === "failed") {
    return { tone: "alert", label: "Swap failed" };
  }
  return { tone: "alert", label: "Swap request pending" };
}

function MyTeam() {
  const navigate = useNavigate();
  const { studentId: routeStudentId } = useParams();
  const [isSubmittingSwap, setIsSubmittingSwap] = useState(false);
  const [swapFeedback, setSwapFeedback] = useState("");
  const [swapError, setSwapError] = useState("");
  const {
    activeStudent,
    activeStudentRouteId,
    activeStudentId,
    availableStudents,
    isLoadingStudents,
    studentLoadError,
  } = useStudentSession(routeStudentId);

  const {
    teamAssignments,
    selectedTeam,
    setSelectedTeamId,
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
    isSelectedTeamFinalized,
    isLoadingSwapRequests,
    swapRequestError,
    refreshSwapRequests,
  } = useMyTeamPage(activeStudent, isLoadingStudents);

  if (isLoadingStudents) {
    return (
      <div className={styles.page}>
        <section className={styles.hero}>
          <div>
            <h2 className={styles.title}>Your team assignments</h2>
            <p className={styles.subtitle}>
              Loading backend student session...
            </p>
          </div>
        </section>
      </div>
    );
  }

  if (studentLoadError || !activeStudent) {
    return (
      <div className={styles.page}>
        <Link to="/" className={styles.backLink}>
          <ArrowLeft className={styles.backIcon} /> Return to home
        </Link>
        <p className={styles.feedbackAlert}>
          <AlertTriangle className={styles.buttonIcon} />
          {studentLoadError ||
            `Backend did not return a student for ${routeStudentId || "this route"}.`}
        </p>
      </div>
    );
  }

  const studentBasePath = `/student/${activeStudentRouteId}`;
  const sourceTone = assignmentError
    ? "alert"
    : assignmentSource === "backend"
      ? "success"
      : "neutral";

  const activeStudentBackendId = Number(activeStudent?.backendStudentId);

  async function handleSwapSubmit(event) {
    event.preventDefault();

    if (isSelectedTeamFinalized) {
      setSwapError(
        "Swap requests are closed because this section is already confirmed.",
      );
      return;
    }

    if (!Number.isFinite(activeStudentBackendId)) {
      setSwapError(
        "Unable to resolve your backend student id for this request.",
      );
      return;
    }

    if (!selectedTeam?.id) {
      setSwapError("No selected team was found for this request.");
      return;
    }

    setIsSubmittingSwap(true);
    setSwapError("");
    setSwapFeedback("");

    try {
      await createSwapRequest({
        studentId: activeStudentBackendId,
        currentTeamId: selectedTeam.id,
        reason: swapReason,
      });
      refreshSwapRequests();
      setSwapFeedback(
        "Swap request submitted. Your instructor can now review it.",
      );
      setSwapReason("");
      setShowSwapModal(false);
    } catch (error) {
      setSwapError(
        error?.message || "Unable to submit your swap request right now.",
      );
    } finally {
      setIsSubmittingSwap(false);
    }
  }

  if (!isLoadingAssignments && !selectedTeam) {
    return (
      <div className={styles.page}>
        <Link to={studentBasePath} className={styles.backLink}>
          <ArrowLeft className={styles.backIcon} /> Return to student home
        </Link>
        <p className={styles.feedbackAlert}>
          <AlertTriangle className={styles.buttonIcon} />
          {assignmentError ||
            "The backend did not return any team assignments for this student."}
        </p>
      </div>
    );
  }

  const assignmentHeaderLabel = selectedTeam
    ? `${selectedTeam.courseCode || selectedTeam.courseId} :: ${selectedTeam.groupCode || selectedTeam.groupId}`
    : "Backend team";
  const selectedSwapMeta = selectedTeamSwapRequest
    ? getSwapRequestMeta(selectedTeamSwapRequest.status)
    : null;
  const isSwapRequestDisabled = !selectedTeam || isSelectedTeamFinalized;

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <Link to={studentBasePath} className={styles.backLink}>
        <ArrowLeft className={styles.backIcon} /> Return to student home
      </Link>

      <section className={styles.hero}>
        <div>
          <h2 className={styles.title}>Your team assignments</h2>
          <p className={styles.subtitle}>
            You are allocated to a team automatically and can optionally request
            a swap.
          </p>
        </div>
        <div className={styles.heroTags}>
          <StudentSwitcher
            activeStudentId={activeStudentId}
            availableStudents={availableStudents}
            onChange={(nextStudentId) =>
              navigate(`/student/${nextStudentId}/team`)
            }
          />
          <SystemTag tone={sourceTone}>
            {isLoadingAssignments
              ? "Loading assignments"
              : assignmentError
                ? "Backend data unavailable"
                : "Team allocations loaded"}
          </SystemTag>
          <SystemTag tone={selectedSwapMeta?.tone || "neutral"}>
            {isLoadingSwapRequests
              ? "Loading swap status"
              : selectedSwapMeta?.label || "No swap request yet"}
          </SystemTag>
          <Button
            onClick={() => {
              if (isSwapRequestDisabled) {
                return;
              }
              setShowSwapModal(true);
            }}
            disabled={isSwapRequestDisabled}
            title={
              isSelectedTeamFinalized
                ? "Swap requests are closed because this section is confirmed."
                : undefined
            }
          >
            <RefreshCw className={styles.buttonIcon} /> Request team swap
          </Button>
        </div>
      </section>

      {isSelectedTeamFinalized ? (
        <p className={styles.feedbackAlert}>
          <AlertTriangle className={styles.buttonIcon} />
          Swap requests are closed for this team because the section is
          confirmed.
        </p>
      ) : null}

      {assignmentError ? (
        <p className={styles.feedbackAlert}>
          <AlertTriangle className={styles.buttonIcon} />
          {assignmentError}
        </p>
      ) : null}
      {swapRequestError ? (
        <p className={styles.feedbackAlert}>
          <AlertTriangle className={styles.buttonIcon} />
          {swapRequestError}
        </p>
      ) : null}

      <section className={styles.statsGrid}>
        {[
          {
            title: "Course Groups",
            metric: String(teamAssignments.length).padStart(2, "0"),
            label: "Backend assignments",
            accent: "blue",
          },
          {
            title: "Selected Team",
            metric: selectedTeam ? String(selectedTeam.members.length) : "00",
            label: "Members in this team",
            accent: "green",
          },
          {
            title: "Swap Option",
            metric: String(mySwapRequests.length).padStart(2, "0"),
            label: "Your swap requests",
            accent: "orange",
          },
        ].map((item, index) => (
          <ModuleBlock
            key={item.title}
            title={item.title}
            metric={item.metric}
            metricLabel={item.label}
            accent={item.accent}
            className={`${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
            style={{ "--td-stagger-delay": `${index * 50}ms` }}
          />
        ))}
      </section>

      <ModuleBlock
        componentId="MOD-M4"
        eyebrow="Assignments"
        title="Assigned Teams"
        className={`${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
        style={{ "--td-stagger-delay": "150ms" }}
      >
        <div className={styles.assignmentStack}>
          {teamAssignments.map((team, index) => {
            const sectionKey = String(team.sectionId || team.groupId || "");
            const sectionSwapRequest = swapRequestBySection[sectionKey] ?? null;
            const sectionSwapMeta = sectionSwapRequest
              ? getSwapRequestMeta(sectionSwapRequest.status)
              : null;

            return (
              <button
                key={team.id}
                onClick={() => setSelectedTeamId(team.id)}
                className={`${styles.assignmentCard} ${selectedTeam?.id === team.id ? styles.assignmentCardActive : ""} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
                style={{ "--td-stagger-delay": `${(index + 1) * 50}ms` }}
              >
                <div className={styles.assignmentHeader}>
                  <p className={styles.assignmentTitle}>
                    You have been assigned to {team.name}
                  </p>
                  <div className={styles.tagRow}>
                    <SystemTag tone="success">Allocated</SystemTag>
                    {sectionSwapMeta ? (
                      <SystemTag tone={sectionSwapMeta.tone}>
                        {sectionSwapMeta.label}
                      </SystemTag>
                    ) : null}
                  </div>
                </div>
                <p className={styles.assignmentMeta}>
                  {assignmentHeaderLabel} :: {team.members.length} members
                </p>
              </button>
            );
          })}
        </div>
      </ModuleBlock>

      {selectedTeam ? (
        <ModuleBlock
          componentId="MOD-M5"
          eyebrow="Selected Team"
          title={selectedTeam.name}
          className={`${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
          style={{ "--td-stagger-delay": "200ms" }}
        >
          <div className={styles.teamHeader}>
            <GroupChip
              code={selectedTeam.groupCode || selectedTeam.groupId}
              meta={`${selectedTeam.members.length} members`}
              tone="blue"
              className={motionStyles.magneticItem}
            />
            <div className={styles.teamActions}>
              <SystemTag tone="success">
                You are allocated to this team
              </SystemTag>
              {selectedSwapMeta ? (
                <SystemTag tone={selectedSwapMeta.tone}>
                  {selectedSwapMeta.label}
                </SystemTag>
              ) : null}
            </div>
          </div>

          <div className={styles.memberList}>
            {selectedTeam.members.map((member, index) => {
              const isCurrentUser =
                member.id === activeStudent.id ||
                member.studentId === activeStudent.studentId ||
                member.email === activeStudent.email;

              return (
                <div
                  key={member.id}
                  className={`${styles.memberCard} ${isCurrentUser ? styles.memberCardActive : ""} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
                  style={{ "--td-stagger-delay": `${index * 50}ms` }}
                >
                  <div className={styles.memberIdentity}>
                    <div className={styles.memberAvatar}>
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <p className={styles.memberName}>
                        {member.name}{" "}
                        {isCurrentUser ? (
                          <span className={styles.youTag}>[YOU]</span>
                        ) : null}
                      </p>
                      <p className={styles.memberMeta}>{member.studentId}</p>
                    </div>
                  </div>
                  <div className={styles.memberDetail}>
                    <SystemTag tone={isCurrentUser ? "success" : "neutral"}>
                      {isCurrentUser ? "You" : "Teammate"}
                    </SystemTag>
                    <div className={styles.mailLine}>
                      <Mail className={styles.mailIcon} />{" "}
                      <span>{member.email}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ModuleBlock>
      ) : null}

      {showSwapModal ? (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalCard} ${motionStyles.motionPage}`}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalCode}>[SWAP REQUEST]</p>
                <h3 className={styles.modalTitle}>Request a team change</h3>
              </div>
              <SystemTag hazard>Instructor review required</SystemTag>
            </div>
            <form onSubmit={handleSwapSubmit} className={styles.modalForm}>
              {swapError ? (
                <p className={styles.feedbackAlert}>
                  <AlertTriangle className={styles.buttonIcon} />
                  {swapError}
                </p>
              ) : null}
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Reason</span>
                <textarea
                  value={swapReason}
                  onChange={(event) => setSwapReason(event.target.value)}
                  rows={5}
                  className={styles.textarea}
                  placeholder="Explain why you would like to change teams..."
                  required
                />
              </label>
              <div className={styles.modalActions}>
                <Button type="submit" disabled={isSubmittingSwap}>
                  {isSubmittingSwap ? "Submitting..." : "Submit request"}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowSwapModal(false);
                    setSwapReason("");
                    setSwapError("");
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {swapFeedback ? (
        <p className={styles.feedbackAlert}>{swapFeedback}</p>
      ) : null}
    </div>
  );
}

export default MyTeam;
