import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, FileText, Users, Clock } from "lucide-react";
import ModuleBlock from "../../components/schematic/ModuleBlock";
import SystemTag from "../../components/schematic/SystemTag";
import motionStyles from "../../components/schematic/motion.module.css";
import MockStudentSwitcher from "../../components/student/MockStudentSwitcher";
import { mockCourses, mockForms } from "../../data/mockData";
import { loadAssignmentsForStudent } from "./logic/studentDashboardLogic";
import { useMockStudentSession } from "../../services/mockStudentSession";
import { getPendingPeerEvaluations } from "../../services/peerEvaluationService";
import styles from "./StudentDashboard.module.css";

function StudentDashBoard() {
  const {
    activeStudent,
    activeStudentTeams,
    activeStudentId,
    setActiveStudentId,
    availableStudents,
  } = useMockStudentSession();
  const studentProfile = activeStudent;
  const [teamAssignments, setTeamAssignments] = useState(activeStudentTeams);
  const [assignmentSource, setAssignmentSource] = useState("mock");
  const [assignmentError, setAssignmentError] = useState("");
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
  const [pendingPeerRounds, setPendingPeerRounds] = useState([]);

  useEffect(() => {
    loadAssignmentsForStudent(
      studentProfile,
      activeStudentTeams,
      setTeamAssignments,
      setAssignmentSource,
      setPendingPeerRounds,
      setAssignmentError,
      setIsLoadingAssignments,
    );
  }, [activeStudentTeams, studentProfile]);

  const groupIds = new Set(teamAssignments.map((team) => team.groupId));
  const availableFormList = Object.values(mockForms).filter((form) =>
    groupIds.has(form.groupId),
  );
  const nextForm = availableFormList[0] || null;
  const formActionTo =
    availableFormList.length > 1
      ? "/student/form"
      : nextForm
        ? `/student/form/${nextForm.id}`
        : "/student";
  const formActionState =
    availableFormList.length > 1
      ? { availableFormIds: availableFormList.map((form) => form.id) }
      : undefined;
  const formActionText =
    availableFormList.length > 1
      ? "Choose which group form you want to complete before submitting your answers."
      : "Open one of your group forms and submit your answers.";
  const pendingConfirmations = useMemo(
    () =>
      teamAssignments.filter((team) =>
        team.members.some(
          (member) =>
            (member.id === studentProfile.id ||
              member.studentId === studentProfile.studentId ||
              member.email === studentProfile.email) &&
            member.confirmationStatus === "pending",
        ),
      ).length,
    [
      studentProfile.email,
      studentProfile.id,
      studentProfile.studentId,
      teamAssignments,
    ],
  );
  const assignmentTone = assignmentError
    ? "alert"
    : assignmentSource === "backend"
      ? "success"
      : "neutral";
  const nextPeerRound = pendingPeerRounds[0] || null;

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <section
        className={`${styles.hero} ${motionStyles.staggerItem}`}
        style={{ "--td-stagger-delay": "0ms" }}
      >
        <div>
          <h2 className={styles.title}>Student Dashboard</h2>
          <p className={styles.subtitle}>
            Welcome back, {studentProfile.name}. You are currently assigned to{" "}
            {teamAssignments.length} course group
            {teamAssignments.length > 1 ? "s" : ""}.
          </p>
        </div>
        <div className={styles.heroMeta}>
          <MockStudentSwitcher
            activeStudentId={activeStudentId}
            availableStudents={availableStudents}
            onChange={setActiveStudentId}
          />
          <SystemTag tone={assignmentTone}>
            {isLoadingAssignments
              ? "Loading assignments"
              : assignmentSource === "backend"
                ? "Backend teams loaded"
                : "Mock assignments active"}
          </SystemTag>
        </div>
      </section>
      <section className={styles.statsGrid}>
        {[
          {
            title: "My Teams",
            metric: String(teamAssignments.length).padStart(2, "0"),
            accent: "blue",
          },
          {
            title: "Available Forms",
            metric: String(availableFormList.length).padStart(2, "0"),
            accent: "green",
          },
          {
            title: "Peer Evaluations",
            metric: String(pendingPeerRounds.length).padStart(2, "0"),
            accent: "orange",
          },
        ].map((item, index) => (
          <ModuleBlock
            key={item.title}
            title={item.title}
            metric={item.metric}
            accent={item.accent}
            className={`${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
            style={{ "--td-stagger-delay": `${(index + 1) * 50}ms` }}
          />
        ))}
      </section>

      <section className={styles.actionGrid}>
        {[
          {
            to: "/student/team",
            icon: <Users className={styles.actionIcon} />,
            code: "Quick Link",
            title: "View My Teams",
            text: "See every team you have been assigned to and confirm your place.",
          },
          {
            to: formActionTo,
            state: formActionState,
            icon: <FileText className={styles.actionIcon} />,
            code: "Quick Link",
            title:
              availableFormList.length > 1 ? "Choose A Form" : "Fill In A Form",
            text: formActionText,
          },
          {
            to: nextPeerRound
              ? `/student/peer-evaluation/${nextPeerRound.id}`
              : "/student",
            icon: <FileText className={styles.actionIcon} />,
            code: "Peer Review",
            title: "Complete Peer Evaluation",
            text: nextPeerRound
              ? "Rate your teammates and yourself for the final project review."
              : "No peer evaluation rounds are active right now.",
          },
        ].map((action, index) => (
          <Link
            key={action.code + index}
            to={action.to}
            state={action.state}
            className={`${styles.actionCard} ${motionStyles.staggerItem} ${motionStyles.magneticItem} ${!nextPeerRound && action.code === "Peer Review" ? styles.actionCardDisabled : ""}`}
            style={{ "--td-stagger-delay": `${(index + 4) * 50}ms` }}
          >
            {action.icon}
            <div>
              <p className={styles.actionCode}>{action.code}</p>
              <h3 className={styles.actionTitle}>{action.title}</h3>
              <p className={styles.actionText}>{action.text}</p>
            </div>
          </Link>
        ))}
      </section>

      <ModuleBlock
        componentId="MOD-15"
        eyebrow="Recent Activity"
        title="Form History"
        className={`${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
        style={{ "--td-stagger-delay": "350ms" }}
      >
        <div className={styles.historyState}>
          <Clock className={styles.historyIcon} />
          <div>
            <p className={styles.historyTitle}>Latest submission</p>
            <p className={styles.historyText}>
              Team Formation Survey completed on March 5, 2026.
            </p>
          </div>
        </div>
      </ModuleBlock>
    </div>
  );
}

export default StudentDashBoard;
