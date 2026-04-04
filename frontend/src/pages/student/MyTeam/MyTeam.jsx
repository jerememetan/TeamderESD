import { Link, useNavigate, useParams } from "react-router";
import { AlertTriangle, ArrowLeft, Mail, RefreshCw } from "lucide-react";
import GroupChip from "../../../components/schematic/GroupChip";
import ModuleBlock from "../../../components/schematic/ModuleBlock";
import SystemTag from "../../../components/schematic/SystemTag";
import motionStyles from "../../../components/schematic/motion.module.css";
import StudentSwitcher from "../../../components/student/StudentSwitcher";
import { Button } from "../../../components/ui/button";
import { useStudentSession } from "../../../services/studentSession";
import { useMyTeamPage } from "./logic/useMyTeamPage";
import styles from "./MyTeam.module.css";

function MyTeam() {
  const navigate = useNavigate();
  const { studentId: routeStudentId } = useParams();
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

  const currentMember = selectedTeam?.members.find(
    (member) =>
      member.id === activeStudent.id ||
      member.studentId === activeStudent.studentId ||
      member.email === activeStudent.email,
  );
  const isConfirmed = currentMember?.confirmationStatus === "confirmed";
  const sourceTone = assignmentError
    ? "alert"
    : assignmentSource === "backend"
      ? "success"
      : "neutral";

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

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <Link to={studentBasePath} className={styles.backLink}>
        <ArrowLeft className={styles.backIcon} /> Return to student home
      </Link>

      <section className={styles.hero}>
        <div>
          <h2 className={styles.title}>Your team assignments</h2>
          <p className={styles.subtitle}>
            Backend assignments for {activeStudent.name}.
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
                : "Backend assignments loaded"}
          </SystemTag>
          <Button onClick={() => setShowSwapModal(true)}>
            <RefreshCw className={styles.buttonIcon} /> Request team swap
          </Button>
        </div>
      </section>

      {assignmentError ? (
        <p className={styles.feedbackAlert}>
          <AlertTriangle className={styles.buttonIcon} />
          {assignmentError}
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
            title: "My Confirmation",
            metric: isConfirmed ? "YES" : "PEND",
            label: isConfirmed
              ? "You have confirmed"
              : "Waiting for your confirmation",
            accent: isConfirmed ? "green" : "orange",
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
            const member = team.members.find(
              (item) =>
                item.id === activeStudent.id ||
                item.studentId === activeStudent.studentId ||
                item.email === activeStudent.email,
            );
            const confirmed = member?.confirmationStatus === "confirmed";

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
                  <SystemTag tone={confirmed ? "success" : "neutral"}>
                    {confirmed ? "Confirmed" : "Pending"}
                  </SystemTag>
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
              tone={isConfirmed ? "green" : "orange"}
              className={motionStyles.magneticItem}
            />
            <div className={styles.teamActions}>
              <SystemTag tone={isConfirmed ? "success" : "neutral"}>
                {isConfirmed
                  ? "You have confirmed this team"
                  : "Backend team membership loaded"}
              </SystemTag>
            </div>
          </div>

          <div className={styles.memberList}>
            {selectedTeam.members.map((member, index) => {
              const isCurrentUser =
                member.id === activeStudent.id ||
                member.studentId === activeStudent.studentId ||
                member.email === activeStudent.email;
              const memberConfirmed = member.confirmationStatus === "confirmed";

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
                      <p
                        className={`${styles.memberName} ${memberConfirmed ? styles.memberNameConfirmed : styles.memberNamePending}`}
                      >
                        {member.name}{" "}
                        {isCurrentUser ? (
                          <span className={styles.youTag}>[YOU]</span>
                        ) : null}
                      </p>
                      <p className={styles.memberMeta}>{member.studentId}</p>
                    </div>
                  </div>
                  <div className={styles.memberDetail}>
                    <SystemTag tone={memberConfirmed ? "success" : "neutral"}>
                      {memberConfirmed ? "Confirmed" : "Pending"}
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
            <form
              onSubmit={(event) => {
                event.preventDefault();
                alert("Swap request submitted successfully!");
                setShowSwapModal(false);
                setSwapReason("");
              }}
              className={styles.modalForm}
            >
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
                <Button type="submit">Submit request</Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowSwapModal(false);
                    setSwapReason("");
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
    </div>
  );
}

export default MyTeam;
