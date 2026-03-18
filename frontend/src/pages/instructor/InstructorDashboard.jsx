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
  const activeFormsCount = courseGroups.filter((group) => group.formStatus === "active").length;
  const pendingSwapRequests = swapRequestList.filter((request) => request.status === "pending").length;

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>[INSTRUCTOR COMMAND CENTER]</p>
          <h2 className={styles.title}>Monitor courses, groups, forms, and interventions.</h2>
          <p className={styles.subtitle}>
            Each course group is now treated as its own form-bearing unit. The dashboard aggregates the system,
            but the action happens at group level.
          </p>
        </div>
        {pendingSwapRequests > 0 ? (
          <SystemTag hazard>SYSTEM INTERVENTION :: {pendingSwapRequests} pending swaps</SystemTag>
        ) : (
          <SystemTag tone="success">All group operations nominal</SystemTag>
        )}
      </section>

      <section className={styles.statsGrid}>
        {[
          { id: 'MOD-01', eyebrow: 'System Count', title: 'Courses', metric: String(totalCourses).padStart(2, '0'), label: 'Managed course containers', accent: 'blue' },
          { id: 'MOD-02', eyebrow: 'Group Matrix', title: 'Teaching Groups', metric: String(totalGroups).padStart(2, '0'), label: 'Addressable form units', accent: 'green' },
          { id: 'MOD-03', eyebrow: 'Population', title: 'Student Load', metric: String(totalStudents).padStart(3, '0'), label: 'Enrolled across groups', accent: 'blue' },
          { id: 'MOD-04', eyebrow: 'Escalation Queue', title: 'Pending Swaps', metric: String(pendingSwapRequests).padStart(2, '0'), label: 'Requests awaiting decision', accent: 'orange' },
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
          { to: '/instructor/courses', icon: <BookOpen className={styles.actionIcon} />, code: '[ACT-COURSE]', title: 'Open Course Matrix', text: 'Inspect groups, form states, and team-generation configuration.' },
          { to: '/instructor/swap-requests', icon: <AlertCircle className={styles.actionIconAlert} />, code: '[ACT-SWAP]', title: 'Review Interventions', text: 'Approve or reject student swap requests through the intervention queue.' },
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

      <ModuleBlock componentId="MOD-05" eyebrow="Course Topology" title="Recent Course Clusters" className={`${styles.courseModule} ${motionStyles.staggerItem}`} style={{ '--td-stagger-delay': '300ms' }}>
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
                    {course.groups.some((group) => group.formStatus === "active") ? "Active Group Forms" : "Draft / Closed Groups"}
                  </SystemTag>
                  <Link className={styles.inlineLink} to="/instructor/courses">Open matrix</Link>
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
