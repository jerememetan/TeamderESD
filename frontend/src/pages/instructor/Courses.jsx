import { Link } from "react-router";
import { Plus, Users } from "lucide-react";
import GroupChip from "../../components/schematic/GroupChip";
import ModuleBlock from "../../components/schematic/ModuleBlock";
import SystemTag from "../../components/schematic/SystemTag";
import motionStyles from "../../components/schematic/motion.module.css";
import { mockCourses, mockForms } from "../../data/mockData";
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
          <p className={styles.subtitle}>Instructors now create a separate form for each teaching group under the same course.</p>
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

                  return (
                    <div key={group.id} className={`${styles.groupCard} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`} style={{ '--td-stagger-delay': `${(courseIndex * 3 + groupIndex + 1) * 50}ms` }}>
                      <div className={styles.groupHeader}>
                        <GroupChip code={group.code} meta={`${group.studentsCount} students · ${group.teamsCount} teams`} tone={tone} className={motionStyles.magneticItem} />
                        <SystemTag tone={group.formStatus === 'active' ? 'success' : group.formStatus === 'closed' ? 'alert' : 'neutral'}>
                          Form {group.formStatus}
                        </SystemTag>
                      </div>
                      <div className={styles.groupActions}>
                        <Link className={styles.inlineLink} to={`/instructor/courses/${course.id}/groups/${group.id}/create-form`}>
                          {existingForm ? 'Edit group form' : 'Create group form'}
                        </Link>
                        <Link className={styles.inlineLinkMuted} to={`/instructor/courses/${course.id}/groups/${group.id}/analytics`}>
                          View analytics
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className={styles.footerAction}>
                <Link className={styles.teamsLink} to={`/instructor/courses/${course.id}/teams`}>
                  <Users className={styles.buttonIcon} />
                  View All Teams
                </Link>
              </div>
            </ModuleBlock>
          );
        })}
      </div>
    </div>
  );
}

export default Courses;
