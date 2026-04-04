// no React hooks imported directly; component uses services/hooks
import { Link, useNavigate, useParams } from "react-router";
import { AlertTriangle, FileText, Users } from "lucide-react";
import ModuleBlock from "../../../components/schematic/ModuleBlock";
import SystemTag from "../../../components/schematic/SystemTag";
import motionStyles from "../../../components/schematic/motion.module.css";
import StudentSwitcher from "../../../components/student/StudentSwitcher";
import { useStudentSession } from "../../../services/studentSession";
import { useDashboardSummary } from "./logic/studentDashboardLogic";
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
  } = useStudentSession(routeStudentId, { deferStudentsLoad: true });

  const {
    teamCount,
    peerEvalCount,
    nextPeerRound,
    availableForms,
    isLoading: isLoadingSummary,
    error: summaryError,
  } = useDashboardSummary(activeStudent);

  const resolvedRouteStudentId =
    routeStudentId || activeStudentRouteId || "backend-unavailable";
  const studentBasePath = `/student/${resolvedRouteStudentId}`;
  const resolvedStudentName =
    activeStudent?.name || `Student ${resolvedRouteStudentId}`;
  const availableFormList = availableForms || [];
  const formActionTo = `${studentBasePath}/form`;
  const formActionText =
    isLoadingSummary || isLoadingStudents
      ? "Loading your available section forms."
      : availableFormList.length > 1
        ? "View your available forms"
        : "No forms assigned to you.";
  const feedbackMessage = [studentLoadError, summaryError]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <section
        className={`${styles.hero} ${motionStyles.staggerItem}`}
        style={{ "--td-stagger-delay": "0ms" }}
      >
        <div>
          <h2 className={styles.title}>Student Dashboard</h2>
          <p className={styles.subtitle}>Welcome back, {resolvedStudentName}</p>
        </div>
        <div className={styles.heroMeta}>
          {availableStudents.length ? (
            <StudentSwitcher
              activeStudentId={activeStudentId}
              availableStudents={availableStudents}
              onChange={(nextStudentId) =>
                navigate(`/student/${nextStudentId}`)
              }
            />
          ) : (
            <p className={styles.sourceNote}>Loading students...</p>
          )}
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
            metric:
              isLoadingSummary || isLoadingStudents
                ? "--"
                : String(teamCount).padStart(2, "0"),
            accent: "blue",
          },
          {
            title: "Available Forms",
            metric:
              isLoadingSummary || isLoadingStudents
                ? "--"
                : String(availableFormList.length).padStart(2, "0"),
            accent: "green",
          },
          {
            title: "Peer Evaluations",
            metric:
              isLoadingSummary || isLoadingStudents
                ? "--"
                : String(peerEvalCount).padStart(2, "0"),
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
            text: "See your assigned teams",
          },
          {
            to: formActionTo,
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
    </div>
  );
}

export default StudentDashBoard;
