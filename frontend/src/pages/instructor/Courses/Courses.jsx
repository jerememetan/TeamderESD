import { Link } from "react-router";
import { ArrowLeft, Plus } from "lucide-react";
import ModuleBlock from "../../../components/schematic/ModuleBlock";
import SystemTag from "../../../components/schematic/SystemTag";
import motionStyles from "../../../components/schematic/motion.module.css";
import { Button } from "../../../components/ui/button";
import { mockCourses, mockForms, mockTeams } from "../../../data/mockData";
import chrome from "../../../styles/instructorChrome.module.css";
import styles from "./Courses.module.css";
import { STAGE_CONFIG } from "./logic/stageConfig";
import { getGroupActions } from "./logic/getGroupActions";

function Courses() {
  // currently taking from mockCourses
  // currently still taking from mockForms
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
        {/* Button for Add course Not done yet */}
        <Button className={chrome.primaryAction}>
          <Plus className={chrome.buttonIcon} />
          Add Course
        </Button>
      </section>

      <div className={styles.courseList}>
        {/* Takes in a courseList - array of objects, courses data mapped to the corresponding
        groups*/}
        {courseList.map((course, courseIndex) => {
          const totalStudents = course.groups.reduce(
            (sum, group) => sum + group.studentsCount,
            0,
          );

          return (
            // This is per course, course data 
            // object id, code, name
            <ModuleBlock
              key={course.id} 
              title={
                <span className={styles.courseHeading}>
                  {course.code} <span className={styles.courseDash}>-</span>{" "}
                  {course.name} 
                </span>
              }
              className={`${styles.courseBlock} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
              style={{ "--td-stagger-delay": `${courseIndex * 50}ms` }}
            >
              <p className={styles.courseSummary}>
                {String(course.groups.length).padStart(2, "0")} Groups |{" "}
                {totalStudents} students
              </p>

              {/* This is for per courseGroup Data */}
              <div className={styles.groupGrid}>
                {course.groups.map((group, groupIndex) => {
                  const existingForm = formMap[group.id];
                  const groupTeams = mockTeams.filter(
                    (team) => team.groupId === group.id,
                  );
                  const actions = getGroupActions(
                    course.id,
                    group,
                    existingForm,
                  );
                  const stage = STAGE_CONFIG[group.lifecycleStage];
                  const completionText = existingForm
                    ? `${existingForm.responseCount} / ${existingForm.totalStudents} submitted`
                    : "No form published";

                  return (
                    <div
                      key={group.id}
                      className={`${styles.groupCard} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
                      style={{
                        "--td-stagger-delay": `${(courseIndex * 3 + groupIndex + 1) * 50}ms`,
                        "--group-action-columns": actions.length,
                      }}
                    >
                      <div className={styles.groupHeader}>
                        <div className={styles.groupTitleWrap}>
                          <h3 className={styles.groupTitle}>{group.code}</h3>
                          <p className={styles.groupStats}>
                            {group.studentsCount} students | {group.teamsCount}{" "}
                            teams
                          </p>
                        </div>
                        <SystemTag tone={stage.tone}>{stage.label}</SystemTag>
                      </div>

                      <div className={styles.groupMetaRow}>
                        <p className={styles.groupNote}>
                          {group.label} | {groupTeams.length} formed teams
                        </p>
                        {group.lifecycleStage === "collecting" ? (
                          <p className={styles.groupStageMeta}>
                            {completionText}
                          </p>
                        ) : null}
                      </div>

                      <p className={styles.groupStageNote}>{stage.note}</p>

                      <div className={styles.groupActions}>
                        {actions.map((action) => (
                          <Button
                            key={action.label}
                            asChild
                            variant={action.variant}
                          >
                            <Link to={action.to}>{action.label}</Link>
                          </Button>
                        ))}
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
