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
  const totalStudents = courseGroups.reduce((sum, group) => sum + group.studentsCount, 0);
  const pendingSwapRequests = swapRequestList.filter((request) => request.status === "pending").length;

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>[INSTRUCTOR HOME]</p>
          <h2 className={styles.title}>Manage courses, groups, forms, and swap requests.</h2>
          <p className={styles.subtitle}>
            Each course group has its own form, so you can create, review, and adjust teams more clearly.
          </p>
        </div>
        {pendingSwapRequests > 0 ? (
          <SystemTag hazard>{pendingSwapRequests} swap request{pendingSwapRequests > 1 ? 's' : ''} to review</SystemTag>
        ) : (
          <SystemTag tone="success">Everything looks up to date</SystemTag>
        )}
      </section>

      <section className={styles.statsGrid}>
        {[
          { id: 'MOD-01', eyebrow: 'Overview', title: 'Courses', metric: String(totalCourses).padStart(2, '0'), label: 'Courses you manage', accent: 'blue' },
          { id: 'MOD-02', eyebrow: 'Overview', title: 'Groups', metric: String(totalGroups).padStart(2, '0'), label: 'Teaching groups set up', accent: 'green' },
          { id: 'MOD-03', eyebrow: 'Overview', title: 'Students', metric: String(totalStudents).padStart(3, '0'), label: 'Students across groups', accent: 'blue' },
          { id: 'MOD-04', eyebrow: 'Attention', title: 'Pending Swaps', metric: String(pendingSwapRequests).padStart(2, '0'), label: 'Requests waiting for review', accent: 'orange' },
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
            style={{ '--td-stagger-delay': `${index * 50}ms` }}
          />
        ))}
      </section>

      <section className={styles.actionsGrid}>
        {[
          { to: '/instructor/courses', icon: <BookOpen className={styles.actionIcon} />, code: 'Main Action', title: 'View Courses', text: 'Open your course list to manage groups, forms, and teams.' },
          { to: '/instructor/swap-requests', icon: <AlertCircle className={styles.actionIconAlert} />, code: 'Main Action', title: 'Review Swap Requests', text: 'See student swap requests and approve or reject them.' },
        ].map((action, index) => (
          <Link key={action.to} className={`${styles.actionCard} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`} style={{ '--td-stagger-delay': `${(index + 4) * 50}ms` }} to={action.to}>
            {action.icon}
            <div>
              <p className={styles.actionCode}>{action.code}</p>
              <h3 className={styles.actionTitle}>{action.title}</h3>
              <p className={styles.actionText}>{action.text}</p>
            </div>
          </Link>
        ))}
      </section>

      <ModuleBlock componentId="MOD-05" eyebrow="Courses" title="Recent Courses" className={`${styles.courseModule} ${motionStyles.staggerItem}`} style={{ '--td-stagger-delay': '300ms' }}>
        <div className={styles.courseList}>
          {courseList.map((course, courseIndex) => {
            const courseStudentCount = course.groups.reduce((sum, group) => sum + group.studentsCount, 0);

            return (
              <div key={course.id} className={`${styles.courseRow} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`} style={{ '--td-stagger-delay': `${(courseIndex + 6) * 50}ms` }}>
                <div className={styles.courseMeta}>
                  <div>
                    <p className={styles.courseCode}>{course.code}</p>
                    <h3 className={styles.courseName}>{course.name}</h3>
                  </div>
                  <p className={styles.courseSubline}>{course.semester} :: {course.groups.length} groups :: {courseStudentCount} students</p>
                </div>
                <div className={styles.groupRow}>
                  {course.groups.map((group, groupIndex) => (
                    <GroupChip
                      key={group.id}
                      code={group.code}
                      meta={`${group.studentsCount} students · ${group.teamsCount} teams`}
                      tone={group.formStatus === "active" ? "green" : group.formStatus === "closed" ? "orange" : "blue"}
                      className={`${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
                      style={{ '--td-stagger-delay': `${((courseIndex * 2) + groupIndex + 8) * 50}ms` }}
                    />
                  ))}
                </div>
                <div className={styles.statusRow}>
                  <SystemTag tone={course.groups.some((group) => group.formStatus === "active") ? "success" : "neutral"}>
                    {course.groups.some((group) => group.formStatus === "active") ? "Forms are live" : "Still in draft or closed"}
                  </SystemTag>
                  <Link className={styles.inlineLink} to="/instructor/courses">View course details</Link>
                </div>
              </div>
            );
          })}
        </div>
      </ModuleBlock>
    </div>
  );
}

export default InstructorDashboard;
