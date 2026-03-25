import { Link } from "react-router";
import { ArrowLeft, Plus } from "lucide-react";
import ModuleBlock from "../../components/schematic/ModuleBlock";
import SystemTag from "../../components/schematic/SystemTag";
import motionStyles from "../../components/schematic/motion.module.css";
import { Button } from "../../components/ui/button";
import { mockCourses, mockForms, mockTeams } from "../../data/mockData";
import chrome from "../../styles/instructorChrome.module.css";
import styles from "./Courses.module.css";

function Courses() {
  const courseList = mockCourses;
  const formMap = mockForms;

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <Link to="/instructor" className={chrome.backLink}>
        <ArrowLeft className={chrome.backIcon} />
        Back to Dashboard
      </Link>

      <section className={chrome.hero}>
        <div>
          <p className={chrome.kicker}>[COURSES]</p>
          <h2 className={chrome.title}>Manage my courses</h2>
        </div>
        <Button className={chrome.primaryAction}>
          <Plus className={chrome.buttonIcon} />
          Add Course
        </Button>
      </section>

      <div className={styles.courseList}>
        {courseList.map((course, courseIndex) => {
          const totalStudents = course.groups.reduce((sum, group) => sum + group.studentsCount, 0);

          return (
            <ModuleBlock
              key={course.id}
              title={<span className={styles.courseHeading}>{course.code} <span className={styles.courseDash}>-</span> {course.name}</span>}
              className={`${styles.courseBlock} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
              style={{ "--td-stagger-delay": `${courseIndex * 50}ms` }}
            >
              <p className={styles.courseSummary}>{String(course.groups.length).padStart(2, "0")} Groups | {totalStudents} students</p>
              <div className={styles.groupGrid}>
                {course.groups.map((group, groupIndex) => {
                  const existingForm = formMap[group.id];
                  const groupTeams = mockTeams.filter((team) => team.groupId === group.id);

                  return (
                    <div key={group.id} className={`${styles.groupCard} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`} style={{ "--td-stagger-delay": `${(courseIndex * 3 + groupIndex + 1) * 50}ms` }}>
                      <div className={styles.groupHeader}>
                        <div className={styles.groupTitleWrap}>
                          <h3 className={styles.groupTitle}>{group.code}</h3>
                          <p className={styles.groupStats}>{group.studentsCount} students | {group.teamsCount} teams</p>
                        </div>
                        <SystemTag tone={group.formStatus === "active" ? "success" : group.formStatus === "closed" ? "alert" : "neutral"}>
                          Form {group.formStatus}
                        </SystemTag>
                      </div>
                      <div className={styles.groupMetaRow}>
                        <p className={styles.groupNote}>{group.label} | {groupTeams.length} formed teams</p>
                      </div>
                      <div className={styles.groupActions}>
                        <Button asChild variant="default">
                          <Link to={`/instructor/courses/${course.id}/groups/${group.id}/create-form`}>
                            {existingForm ? "Edit group form" : "Create group form"}
                          </Link>
                        </Button>
                        <Button asChild variant="outline">
                          <Link to={`/instructor/courses/${course.id}/groups/${group.id}/analytics`}>
                            View analytics
                          </Link>
                        </Button>
                        <Button asChild variant="outline">
                          <Link to={`/instructor/courses/${course.id}/groups/${group.id}/teams`}>
                            View teams
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ModuleBlock>
          );
        })}
      </div>
    </div>
  );
}

export default Courses;
