import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import ModuleBlock from "../../../components/schematic/ModuleBlock";
import SystemTag from "../../../components/schematic/SystemTag";
import motionStyles from "../../../components/schematic/motion.module.css";
import { Button } from "../../../components/ui/button";
import { mockForms } from "../../../data/mockData";
import chrome from "../../../styles/instructorChrome.module.css";
import styles from "./Courses.module.css";
import { STAGE_CONFIG } from "./logic/stageConfig";
import { getGroupActions } from "./logic/getGroupActions";
import { getEffectiveGroupStage } from "../logic/formationFlow";
import { useCoursesPage } from "./logic/useCoursesPage";

function Courses() {
  const {
    courseList,
    loading,
    statsLoading,
    loadError,
    endingSectionId,
    formingSectionIds,
    handleEndCollection,
  } = useCoursesPage();
  const formMap = mockForms;

  if (loading) {
    return (
      <div className={`${styles.page} ${motionStyles.motionPage}`}>
        <section className={chrome.hero}>
          <div>
            <h2 className={chrome.title}>Manage my courses</h2>
          </div>
        </section>
        <div style={{ padding: 24 }}>Loading courses...</div>
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <Link to="/instructor" className={chrome.backLink}>
        <ArrowLeft className={chrome.backIcon} />
        Back to Dashboard
      </Link>

      <section className={chrome.hero}>
        <div>
          <h2 className={chrome.title}>Manage my courses</h2>
          {statsLoading ? (
            <p className={styles.statsLoading}>
              Updating student and team counts...
            </p>
          ) : null}
          {loadError ? (
            <p className={styles.statsLoading}>
              {loadError}{" "}
              <Link to="/instructor/error-logs">Go to Error Logs</Link>
            </p>
          ) : null}
        </div>
        {/* Button for Add course Not done yet */}
      </section>

      <div className={styles.courseList}>
        {/* Takes in a courseList - array of objects, courses data mapped to the corresponding
        groups*/}
        {courseList.map((course, courseIndex) => {
          const allStudentCountsLoaded = course.groups.every(
            (group) => group.studentsCount !== null,
          );
          const totalStudents = allStudentCountsLoaded
            ? course.groups.reduce((sum, group) => sum + group.studentsCount, 0)
            : null;

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
                {totalStudents === null
                  ? "Loading students..."
                  : `${totalStudents} students`}
              </p>

              {/* This is for per courseGroup Data */}
              <div className={styles.groupGrid}>
                {course.groups.map((group, groupIndex) => {
                  const existingForm = formMap[group.id];
                  const effectiveStage = getEffectiveGroupStage(
                    group,
                    formingSectionIds,
                  );
                  const actions = getGroupActions(course.code, group, {
                    onEndCollection: handleEndCollection,
                    isEndingCollection: endingSectionId === group.id,
                    formingSectionIds,
                  });
                  const stage =
                    STAGE_CONFIG[effectiveStage] || STAGE_CONFIG.setup;
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
                            {group.studentsCount === null
                              ? "Loading students..."
                              : `${group.studentsCount} students`}{" "}
                            |{" "}
                            {group.teamsCount === null
                              ? "Loading teams..."
                              : `${group.teamsCount} teams`}
                          </p>
                        </div>
                        <SystemTag tone={stage.tone}>{stage.label}</SystemTag>
                      </div>

                      <div className={styles.groupMetaRow}>
                        <p className={styles.groupNote}>
                          {group.label} |{" "}
                          {group.teamsCount === null
                            ? "Loading formed teams..."
                            : `${group.teamsCount} formed teams`}
                        </p>
                        {effectiveStage === "collecting" ? (
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
                            asChild={action.kind !== "button"}
                            variant={action.variant}
                            onClick={
                              action.kind === "button"
                                ? action.onClick
                                : undefined
                            }
                            disabled={action.disabled}
                          >
                            {action.kind === "button" ? (
                              <span>{action.label}</span>
                            ) : (
                              <Link to={action.to}>{action.label}</Link>
                            )}
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
