import { Link } from "react-router";
import { AlertCircle, AlertTriangle, BookOpen } from "lucide-react";
import ModuleBlock from "../../../components/schematic/ModuleBlock";
import SystemTag from "../../../components/schematic/SystemTag";
import motionStyles from "../../../components/schematic/motion.module.css";

import styles from "./InstructorDashboard.module.css";
import { useEffect, useState } from "react";
import { fetchDashboardCoursesWithEnrollments } from "./service/dashboardService";


// Instruct Dashboard
function InstructorDashboard() {
  // Initiate Courses, loading, total students, swap requests, and groups state
  const [courses, setCourses] = useState(0);
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [swapRequest, setSwapRequest] = useState(0); // Placeholder
  const [group, setGroup] = useState(0);
  useEffect(() => {
    fetchDashboardCoursesWithEnrollments()
      .then((dashboardCourses) => {
        // gets courses, loading, enrolled students, swap requests
        setCourses(dashboardCourses.totalCourses);
        setTotalStudents(dashboardCourses.totalStudents);
        setGroup(dashboardCourses.totalGroups);
        setSwapRequest(dashboardCourses.pendingSwapRequests);
        console.log(dashboardCourses);
      })
      .catch(() => {
        setCourses(0);
        setTotalStudents(0);
        setGroup(0);
        setSwapRequest(0);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <section className={styles.hero}>
        <div>
          <h2 className={styles.title}>Instructor Dashboard</h2>
        </div>
        {swapRequest > 0 ? (
          <SystemTag hazard>
            {swapRequest} swap request
            {swapRequest > 1 ? "s" : ""} to review
          </SystemTag>
        ) : (
          <SystemTag tone="success">Everything looks up to date</SystemTag>
        )}
      </section>

      <section className={styles.statsGrid}>
        {loading ? (
          <div>Loading stats...</div>
        ) : (
          [
            {
              title: "Total Courses",
              metric: String(courses).padStart(2, "0"),
              accent: "blue",
            },
            {
              title: "Total Groups",
              metric: String(group).padStart(2, "0"),
              accent: "green",
            },
            {
              title: "Total Students",
              metric: String(totalStudents).padStart(3, "0"),
              accent: "blue",
            },
            {
              title: "Total Pending Swaps",
              metric: String(swapRequest).padStart(2, "0"),
              accent: "orange",
            },
          ].map((item, index) => (
            <ModuleBlock
              key={item.title}
              title={item.title}
              metric={item.metric}
              accent={item.accent}
              className={`${styles.statCard} ${motionStyles.staggerItem}`}
              style={{ "--td-stagger-delay": `${index * 50}ms` }}
            />
          ))
        )}
      </section>

      <section className={styles.actionsGrid}>
        {[
          {
            to: "/instructor/courses",
            icon: <BookOpen className={styles.actionIcon} />,
            title: "View Courses",
            text: "Open your course list to manage groups, forms, and teams.",
          },
              {
                to: "/instructor/error-logs",
                icon: <AlertTriangle className={styles.actionIconAlert} />,
                title: "Inspect Error Logs",
                text: "Review RabbitMQ error events and remove logs after triage.",
              },
          {
            to: "/instructor/swap-requests",
            icon: <AlertCircle className={styles.actionIconAlert} />,
            title: "Review Swap Requests",
            text: "See student swap requests and approve or reject them.",
          },
        ].map((action, index) => (
          <Link
            key={action.to}
            className={`${styles.actionCard} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
            style={{ "--td-stagger-delay": `${(index + 4) * 50}ms` }}
            to={action.to}
          >
            {action.icon}
            <div>
              <h3 className={styles.actionTitle}>{action.title}</h3>
              <p className={styles.actionText}>{action.text}</p>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}

export default InstructorDashboard;
