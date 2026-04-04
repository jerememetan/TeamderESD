import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { AlertTriangle, Clock, FileText, Users } from "lucide-react";
import ModuleBlock from "../../components/schematic/ModuleBlock";
import SystemTag from "../../components/schematic/SystemTag";
import motionStyles from "../../components/schematic/motion.module.css";
import StudentSwitcher from "../../components/student/StudentSwitcher";
import { useStudentSession } from "../../services/studentSession";
import { loadAssignmentsForStudent, loadFormsForStudent } from "./logic/studentDashboardLogic";
import styles from "./StudentDashboard.module.css";

function StudentDashBoard() {
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

  const [teamAssignments, setTeamAssignments] = useState([]);
  const [assignmentSource, setAssignmentSource] = useState("loading");
  const [assignmentError, setAssignmentError] = useState("");
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
  const [pendingPeerRounds, setPendingPeerRounds] = useState([]);
  const [availableForms, setAvailableForms] = useState([]);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (isLoadingStudents || !activeStudent) {
      return;
    }

    loadAssignmentsForStudent(
      activeStudent,
      setTeamAssignments,
      setAssignmentSource,
      setPendingPeerRounds,
      setAssignmentError,
      setIsLoadingAssignments,
    );
  }, [activeStudent, isLoadingStudents]);

  useEffect(() => {
    if (isLoadingStudents || !activeStudent) {
      return;
    }

    loadFormsForStudent(activeStudent, teamAssignments, setAvailableForms, setFormError);
  }, [activeStudent, isLoadingStudents, teamAssignments]);

  if (isLoadingStudents) {
    return (
      <div className={styles.page}>
        <section className={styles.hero}>
          <div>
            <h2 className={styles.title}>Student Dashboard</h2>
            <p className={styles.subtitle}>Loading backend student session...</p>
          </div>
        </section>
      </div>
    );
  }

  if (studentLoadError || !activeStudent) {
    return (
      <div className={styles.page}>
        <Link to="/" className={styles.actionCard} style={{ width: "fit-content" }}>
          Return to home
        </Link>
        <p className={styles.feedbackAlert}>
          <AlertTriangle className={styles.actionIcon} />
          {studentLoadError || `Backend did not return a student for ${routeStudentId || "this route"}.`}
        </p>
      </div>
    );
  }

  const studentBasePath = `/student/${activeStudentRouteId}`;
  const availableFormList = availableForms;
  const nextPeerRound = pendingPeerRounds[0] || null;
  const formActionTo =
    availableFormList.length > 1
      ? `${studentBasePath}/form`
      : availableFormList[0]
        ? `${studentBasePath}/form/${availableFormList[0].id}`
        : studentBasePath;
  const formActionState =
    availableFormList.length > 1
      ? { availableFormIds: availableFormList.map((form) => form.id) }
      : undefined;
  const formActionText =
    availableFormList.length > 1
      ? "Choose which section form you want to complete."
      : availableFormList.length === 1
        ? "Open your assigned section form and submit your answers."
        : "No section forms are currently available for this student.";
  const assignmentTone = assignmentError || formError ? "alert" : assignmentSource === "backend" ? "success" : "neutral";
  const statusText = isLoadingAssignments
    ? "Loading assignments"
    : assignmentError || formError
      ? "Backend data unavailable"
      : assignmentSource === "backend"
      ? "Backend teams loaded"
      : "Backend data unavailable";
  const feedbackMessage = [assignmentError, formError].filter(Boolean).join(" ");

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <section
        className={`${styles.hero} ${motionStyles.staggerItem}`}
        style={{ "--td-stagger-delay": "0ms" }}
      >
        <div>
          <h2 className={styles.title}>Student Dashboard</h2>
          <p className={styles.subtitle}>
            Welcome back, {activeStudent.name}. You are currently assigned to {teamAssignments.length} course group
            {teamAssignments.length > 1 ? "s" : ""}.
          </p>
        </div>
        <div className={styles.heroMeta}>
          <StudentSwitcher
            activeStudentId={activeStudentId}
            availableStudents={availableStudents}
            onChange={(nextStudentId) => navigate(`/student/${nextStudentId}`)}
          />
          <SystemTag tone={assignmentTone}>{statusText}</SystemTag>
        </div>
      </section>

      {feedbackMessage ? (
        <p className={styles.feedbackAlert}>
          <AlertTriangle className={styles.actionIcon} />
          {feedbackMessage}
        </p>
      ) : null}

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
            to: `${studentBasePath}/team`,
            icon: <Users className={styles.actionIcon} />,
            code: "Quick Link",
            title: "View My Teams",
            text: "See every team returned by the backend for this student.",
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
              ? `${studentBasePath}/peer-evaluation/${nextPeerRound.id}`
              : studentBasePath,
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
              Form availability is derived from your current team section assignments.
            </p>
          </div>
        </div>
      </ModuleBlock>
    </div>
  );
}

export default StudentDashBoard;
