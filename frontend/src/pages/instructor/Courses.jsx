import { Link } from "react-router";
import { Plus } from "lucide-react";
import GroupChip from "../../components/schematic/GroupChip";
import ModuleBlock from "../../components/schematic/ModuleBlock";
import SystemTag from "../../components/schematic/SystemTag";
import motionStyles from "../../components/schematic/motion.module.css";
import { mockCourses, mockForms, mockTeams } from "../../data/mockData";
import styles from "./Courses.module.css";

function Courses() {
  const courseList = mockCourses;
  const formMap = mockForms;

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <section className={styles.header}>
        <div>
          <p className={styles.kicker}>[COURSE MATRIX]</p>
          <h2 className={styles.title}>Manage course groups as independent formation channels.</h2>
          <p className={styles.subtitle}>Each teaching group has its own form, analytics view, and team list.</p>
        </div>
        <button className={styles.headerButton}>
          <Plus className={styles.buttonIcon} />
          Add Course
        </button>
      </section>

      <div className={styles.courseList}>
        {courseList.map((course, courseIndex) => {
          const totalStudents = course.groups.reduce((sum, group) => sum + group.studentsCount, 0);

          return (
            <ModuleBlock
              key={course.id}
              componentId={`MOD-C${courseIndex + 1}`}
              eyebrow={course.code}
              title={course.name}
              metric={String(course.groups.length).padStart(2, '0')}
              metricLabel={`Groups :: ${totalStudents} students`}
              className={`${styles.courseBlock} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
              style={{ '--td-stagger-delay': `${courseIndex * 50}ms` }}
            >
              <p className={styles.courseSemester}>{course.semester}</p>
              <div className={styles.groupGrid}>
                {course.groups.map((group, groupIndex) => {
                  const existingForm = formMap[group.id];
                  const tone = group.formStatus === 'active' ? 'green' : group.formStatus === 'closed' ? 'orange' : 'blue';
                  const groupTeams = mockTeams.filter((team) => team.groupId === group.id);

                  return (
                    <div key={group.id} className={`${styles.groupCard} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`} style={{ '--td-stagger-delay': `${(courseIndex * 3 + groupIndex + 1) * 50}ms` }}>
                      <div className={styles.groupHeader}>
                        <GroupChip code={group.code} meta={`${group.studentsCount} students · ${group.teamsCount} teams`} tone={tone} className={motionStyles.magneticItem} />
                        <SystemTag tone={group.formStatus === 'active' ? 'success' : group.formStatus === 'closed' ? 'alert' : 'neutral'}>
                          Form {group.formStatus}
                        </SystemTag>
                      </div>
                      <div className={styles.groupMetaRow}>
                        <p className={styles.groupNote}>{group.label} :: {groupTeams.length} formed teams</p>
                      </div>
                      <div className={styles.groupActions}>
                        <Link className={`${styles.groupActionButton} ${styles.groupActionPrimary}`} to={`/instructor/courses/${course.id}/groups/${group.id}/create-form`}>
                          {existingForm ? 'Edit group form' : 'Create group form'}
                        </Link>
                        <Link className={styles.groupActionButton} to={`/instructor/courses/${course.id}/groups/${group.id}/analytics`}>
                          View analytics
                        </Link>
                        <Link className={styles.groupActionButton} to={`/instructor/courses/${course.id}/groups/${group.id}/teams`}>
                          View teams
                        </Link>
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
