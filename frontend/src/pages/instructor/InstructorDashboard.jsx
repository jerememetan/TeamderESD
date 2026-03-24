import { Link } from "react-router";
import { AlertCircle, BookOpen } from "lucide-react";
import GroupChip from "../../components/schematic/GroupChip";
import ModuleBlock from "../../components/schematic/ModuleBlock";
import SystemTag from "../../components/schematic/SystemTag";
import motionStyles from "../../components/schematic/motion.module.css";
import { mockCourses, mockSwapRequests } from "../../data/mockData";
import styles from "./InstructorDashboard.module.css";

function InstructorDashboard() {
  const courseList = mockCourses;
  const swapRequestList = mockSwapRequests;
  const courseGroups = courseList.flatMap((course) => course.groups);

  const totalCourses = courseList.length;
  const totalGroups = courseGroups.length;
  const totalStudents = courseGroups.reduce(
    (sum, group) => sum + group.studentsCount,
    0,
  );
  const pendingSwapRequests = swapRequestList.filter(
    (request) => request.status === "pending",
  ).length;

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <section className={styles.hero}>
        <div>
          <h2 className={styles.title}>
            Instructor Dashboard
          </h2>
        </div>
        {pendingSwapRequests > 0 ? (
          <SystemTag hazard>
            {pendingSwapRequests} swap request
            {pendingSwapRequests > 1 ? "s" : ""} to review
          </SystemTag>
        ) : (
          <SystemTag tone="success">Everything looks up to date</SystemTag>
        )}
      </section>

      <section className={styles.statsGrid}>
        {[
          {
            title: "Total Courses",
            metric: String(totalCourses).padStart(2, "0"),
            accent: "blue",
          },
          {
            title: "Total Groups",
            metric: String(totalGroups).padStart(2, "0"),
            accent: "green",
          },
          {
            title: "Total Students",
            metric: String(totalStudents).padStart(3, "0"),
            accent: "blue",
          },
          {
            title: "Total Pending Swaps",
            metric: String(pendingSwapRequests).padStart(2, "0"),
            accent: "orange",
          },
        ].map((item, index) => (
          <ModuleBlock
            key={item.id}
            componentId={item.id}
            eyebrow={item.eyebrow}
            title={item.title}
            metric={item.metric}
            metricLabel={item.label}
            accent={item.accent}
            className={`${styles.statCard} ${motionStyles.staggerItem}`}
            style={{ "--td-stagger-delay": `${index * 50}ms` }}
          />
        ))}
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

export default InstructorDashboard;

