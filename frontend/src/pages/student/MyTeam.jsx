import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, ArrowLeft, Mail, RefreshCw } from "lucide-react";
import GroupChip from "../../components/schematic/GroupChip";
import ModuleBlock from "../../components/schematic/ModuleBlock";
import SystemTag from "../../components/schematic/SystemTag";
import motionStyles from "../../components/schematic/motion.module.css";
import { currentStudent, currentStudentTeams, mockCourses, mockStudentStrengths } from "../../data/mockData";
import { fetchStudentAssignments } from "../../services/studentAssignmentService";
import styles from "./MyTeam.module.css";

function MyTeam() {
  const studentProfile = currentStudent;
  const [teamAssignments, setTeamAssignments] = useState(currentStudentTeams);
  const [selectedTeamId, setSelectedTeamId] = useState(currentStudentTeams[0]?.id ?? null);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapReason, setSwapReason] = useState("");
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
  const [assignmentSource, setAssignmentSource] = useState("mock");
  const [assignmentError, setAssignmentError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadAssignments() {
      setIsLoadingAssignments(true);
      setAssignmentError("");

      try {
        const backendAssignments = await fetchStudentAssignments({
          currentStudentId: studentProfile.id,
          courses: mockCourses,
        });

        if (!isMounted) {
          return;
        }

        if (backendAssignments.length) {
          setTeamAssignments(backendAssignments);
          setSelectedTeamId((currentSelectedTeamId) => currentSelectedTeamId ?? backendAssignments[0].id);
          setAssignmentSource("backend");
        } else {
          setTeamAssignments(currentStudentTeams);
          setSelectedTeamId((currentSelectedTeamId) => currentSelectedTeamId ?? currentStudentTeams[0]?.id ?? null);
          setAssignmentSource("mock");
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setTeamAssignments(currentStudentTeams);
        setSelectedTeamId((currentSelectedTeamId) => currentSelectedTeamId ?? currentStudentTeams[0]?.id ?? null);
        setAssignmentSource("mock");
        setAssignmentError(error.message);
      } finally {
        if (isMounted) {
          setIsLoadingAssignments(false);
        }
      }
    }

    loadAssignments();

    return () => {
      isMounted = false;
    };
  }, [studentProfile.id]);

  const selectedTeam = useMemo(
    () => teamAssignments.find((team) => team.id === selectedTeamId) || teamAssignments[0] || null,
    [selectedTeamId, teamAssignments],
  );

  const selectedCourse = mockCourses.find((course) => course.id === selectedTeam?.courseId);
  const selectedGroup = selectedCourse?.groups.find((group) => group.id === selectedTeam?.groupId);

  const getStrongestCriteria = (studentId) => mockStudentStrengths[studentId] || ["Teamwork", "General contribution"];

  const handleConfirmTeam = () => {
    if (!selectedTeam || assignmentSource === "backend") return;

    setTeamAssignments((currentTeams) =>
      currentTeams.map((team) =>
        team.id !== selectedTeam.id
          ? team
          : {
              ...team,
              members: team.members.map((member) =>
                member.id === studentProfile.id
                  ? { ...member, confirmationStatus: "confirmed" }
                  : member,
              ),
            },
      ),
    );
  };

  const handleSubmitSwapRequest = (event) => {
    event.preventDefault();
    if (!selectedTeam) return;

    console.log("Swap request:", {
      currentTeamId: selectedTeam.id,
      courseId: selectedTeam.courseId,
      groupId: selectedTeam.groupId,
      reason: swapReason,
    });
    alert("Swap request submitted successfully!");
    setShowSwapModal(false);
    setSwapReason("");
  };

  if (!selectedTeam) {
    return <div className={styles.page}>No team assignments found.</div>;
  }

  const currentMember = selectedTeam.members.find(
    (member) => member.id === studentProfile.id || member.studentId === studentProfile.studentId || member.email === studentProfile.email,
  );
  const isConfirmed = currentMember?.confirmationStatus === "confirmed";
  const sourceTone = assignmentError ? "alert" : assignmentSource === "backend" ? "success" : "neutral";

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <Link to="/student" className={styles.backLink}><ArrowLeft className={styles.backIcon} /> Return to student home</Link>

      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>[MY TEAMS]</p>
          <h2 className={styles.title}>Your team assignments</h2>
          <p className={styles.subtitle}>You can be in more than one course group, but only one team in each group.</p>
        </div>
        <div className={styles.heroTags}>
          <SystemTag tone={sourceTone}>{isLoadingAssignments ? "Loading assignments" : assignmentSource === "backend" ? "Backend assignments loaded" : "Mock assignments active"}</SystemTag>
          <button onClick={() => setShowSwapModal(true)} className={styles.primaryButton}><RefreshCw className={styles.buttonIcon} /> Request team swap</button>
        </div>
      </section>

      {assignmentError ? <div className={styles.feedbackAlert}><AlertTriangle className={styles.buttonIcon} /> <span>Backend team load failed: {assignmentError}</span></div> : null}
      {assignmentSource === "mock" && !assignmentError ? <p className={styles.sourceNote}>Backend teams were not found for this student yet, so the page is showing the existing mock assignment data.</p> : null}
      {assignmentSource === "backend" ? <p className={styles.sourceNote}>These assignments are built from backend team memberships enriched with live student-profile data. Confirmation state is still mock-level until that backend slice exists.</p> : null}

      <section className={styles.statsGrid}>
        {[
          { id: "MOD-M1", eyebrow: "Overview", title: "Course Groups", metric: String(teamAssignments.length).padStart(2, "0"), label: "Active team assignments", accent: "blue" },
          { id: "MOD-M2", eyebrow: "Overview", title: "Selected Team", metric: selectedTeam.members.length, label: "Members in this team", accent: "green" },
          { id: "MOD-M3", eyebrow: "Status", title: "My Confirmation", metric: assignmentSource === "backend" ? "SYNC" : isConfirmed ? "YES" : "PEND", label: assignmentSource === "backend" ? "Backend team membership loaded" : isConfirmed ? "You have confirmed" : "Waiting for your confirmation", accent: assignmentSource === "backend" ? "blue" : isConfirmed ? "green" : "orange" },
        ].map((item, index) => (
          <ModuleBlock
            key={item.id}
            componentId={item.id}
            eyebrow={item.eyebrow}
            title={item.title}
            metric={item.metric}
            metricLabel={item.label}
            accent={item.accent}
            className={`${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
            style={{ "--td-stagger-delay": `${index * 50}ms` }}
          />
        ))}
      </section>

      <ModuleBlock componentId="MOD-M4" eyebrow="Assignments" title="Assigned Teams" className={`${motionStyles.staggerItem} ${motionStyles.magneticItem}`} style={{ "--td-stagger-delay": "150ms" }}>
        <div className={styles.assignmentStack}>
          {teamAssignments.map((team, index) => {
            const course = mockCourses.find((item) => item.id === team.courseId);
            const member = team.members.find((item) => item.id === studentProfile.id || item.studentId === studentProfile.studentId || item.email === studentProfile.email);
            const confirmed = member?.confirmationStatus === "confirmed";

            return (
              <button
                key={team.id}
                onClick={() => setSelectedTeamId(team.id)}
                className={`${styles.assignmentCard} ${selectedTeam.id === team.id ? styles.assignmentCardActive : ""} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
                style={{ "--td-stagger-delay": `${(index + 1) * 50}ms` }}
              >
                <div className={styles.assignmentHeader}>
                  <p className={styles.assignmentTitle}>You have been assigned to {team.name}</p>
                  <SystemTag tone={assignmentSource === "backend" ? "neutral" : confirmed ? "success" : "alert"}>
                    {assignmentSource === "backend" ? "Backend team" : confirmed ? "Confirmed" : "Pending"}
                  </SystemTag>
                </div>
                <p className={styles.assignmentMeta}>{course?.code} :: {team.groupId} :: {team.members.length} members</p>
              </button>
            );
          })}
        </div>
      </ModuleBlock>

      <ModuleBlock componentId="MOD-M5" eyebrow="Selected Team" title={selectedTeam.name} className={`${motionStyles.staggerItem} ${motionStyles.magneticItem}`} style={{ "--td-stagger-delay": "200ms" }}>
        <div className={styles.teamHeader}>
          <GroupChip code={selectedGroup?.code || selectedTeam.groupId} meta={`${selectedTeam.members.length} members`} tone={assignmentSource === "backend" ? "blue" : selectedTeam.members.every((member) => member.confirmationStatus === "confirmed") ? "green" : "orange"} className={motionStyles.magneticItem} />
          <div className={styles.teamActions}>
            <SystemTag tone={assignmentSource === "backend" ? "neutral" : isConfirmed ? "success" : "alert"}>
              {assignmentSource === "backend" ? "Backend team membership loaded" : isConfirmed ? "You have confirmed this team" : "Please confirm this team"}
            </SystemTag>
            {!isConfirmed && assignmentSource !== "backend" ? <button onClick={handleConfirmTeam} className={styles.confirmButton}>Confirm my team</button> : null}
          </div>
        </div>

        <div className={styles.memberList}>
          {selectedTeam.members.map((member, index) => {
            const strongestCriteria = getStrongestCriteria(member.id);
            const isCurrentUser = member.id === studentProfile.id || member.studentId === studentProfile.studentId || member.email === studentProfile.email;
            const confirmed = assignmentSource === "backend" ? true : member.confirmationStatus === "confirmed";

            return (
              <div key={member.id} className={`${styles.memberCard} ${isCurrentUser ? styles.memberCardActive : ""} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`} style={{ "--td-stagger-delay": `${index * 50}ms` }}>
                <div className={styles.memberIdentity}>
                  <div className={styles.memberAvatar}>{member.name.charAt(0)}</div>
                  <div>
                    <p className={`${styles.memberName} ${confirmed ? styles.memberNameConfirmed : styles.memberNamePending}`}>
                      {member.name} {isCurrentUser ? <span className={styles.youTag}>[YOU]</span> : null}
                    </p>
                    <p className={styles.memberMeta}>{member.studentId}</p>
                  </div>
                </div>
                <div className={styles.memberDetail}>
                  <SystemTag tone={assignmentSource === "backend" ? "neutral" : confirmed ? "success" : "alert"}>
                    {assignmentSource === "backend" ? "From backend team" : confirmed ? "Confirmed" : "Pending"}
                  </SystemTag>
                  <div className={styles.mailLine}><Mail className={styles.mailIcon} /> <span>{member.email}</span></div>
                  {assignmentSource === "backend" ? null : (
                    <div className={styles.tagRow}>
                      {strongestCriteria.map((criterion) => (
                        <SystemTag key={criterion} tone="neutral">{criterion}</SystemTag>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ModuleBlock>

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
            <form onSubmit={handleSubmitSwapRequest} className={styles.modalForm}>
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
                <button type="submit" className={styles.primaryButton}>Submit request</button>
                <button type="button" onClick={() => { setShowSwapModal(false); setSwapReason(""); }} className={styles.secondaryButton}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default MyTeam;
