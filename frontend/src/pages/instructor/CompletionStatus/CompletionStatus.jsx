import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import ModuleBlock from "../../../components/schematic/ModuleBlock";
import SystemTag from "../../../components/schematic/SystemTag";
import motionStyles from "../../../components/schematic/motion.module.css";
import chrome from "../../../styles/instructorChrome.module.css";
import { fetchCourseByCode } from "../../../services/courseService";
import { getSectionById } from "../../../services/sectionService";
import { fetchAllStudents } from "../../../services/studentService";
import {
  fetchSubmittedStudentFormsBySectionId,
  fetchUnsubmittedStudentFormsBySectionId,
} from "../../../services/studentFormService";
import { buildCompletionStatus } from "./logic/buildCompletionStatus";
import styles from "./CompletionStatus.module.css";

function CompletionStatus() {
  const { courseId, groupId } = useParams();
  const [course, setCourse] = useState(null);
  const [group, setGroup] = useState(null);
  const [status, setStatus] = useState({
    total: 0,
    submitted: [],
    notSubmitted: [],
    percentage: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [nextCourse, nextGroup] = await Promise.all([
          fetchCourseByCode(courseId),
          getSectionById(groupId),
        ]);

        const [students, submittedForms, unsubmittedForms] = await Promise.all([
          fetchAllStudents(),
          fetchSubmittedStudentFormsBySectionId(groupId),
          fetchUnsubmittedStudentFormsBySectionId(groupId),
        ]);

        if (!isMounted) {
          return;
        }

        setCourse(nextCourse);
        setGroup(nextGroup);
        setStatus(buildCompletionStatus(submittedForms, unsubmittedForms, students));
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setError(
          `Completion status load failed: ${loadError?.message || String(loadError)}`,
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [courseId, groupId]);

  const submittedLabel = useMemo(
    () => `${status.submitted.length} submitted`,
    [status.submitted.length],
  );

  const pendingLabel = useMemo(
    () => `${status.notSubmitted.length} not submitted`,
    [status.notSubmitted.length],
  );

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <Link to="/instructor/courses" className={chrome.backLink}>
        <ArrowLeft className={chrome.backIcon} /> Back to Courses
      </Link>

      <section className={chrome.hero}>
        <div>
          <h2 className={chrome.title}>Completion status</h2>
          <p className={chrome.subtitle}>
            {course && group
              ? `${course.code} G${group.section_number}`
              : "Loading section details..."}
          </p>
        </div>
      </section>

      {error ? (
        <ModuleBlock title="Unable to load completion status" accent="orange">
          <p className={styles.error}>{error}</p>
          <Link to="/instructor/error-logs">Go to Error Logs</Link>
        </ModuleBlock>
      ) : null}

      <div className={styles.summary}>
        <div className={styles.metric}>
          <p className={styles.metricLabel}>Total Students</p>
          <p className={styles.metricValue}>{loading ? "..." : status.total}</p>
        </div>
        <div className={styles.metric}>
          <p className={styles.metricLabel}>Submitted</p>
          <p className={styles.metricValue}>{loading ? "..." : status.submitted.length}</p>
        </div>
        <div className={styles.metric}>
          <p className={styles.metricLabel}>Completion %</p>
          <p className={styles.metricValue}>{loading ? "..." : `${status.percentage}%`}</p>
        </div>
      </div>

      <div className={styles.grid}>
        <ModuleBlock title={submittedLabel} accent="green">
          <ul className={styles.list}>
            {status.submitted.map((student) => (
              <li key={student.studentId} className={styles.studentRow}>
                <p className={styles.studentName}>{student.name}</p>
                <p className={styles.studentMeta}>{student.email || `ID ${student.studentId}`}</p>
              </li>
            ))}
            {!status.submitted.length && !loading ? (
              <li className={styles.studentRow}>No submissions yet.</li>
            ) : null}
          </ul>
        </ModuleBlock>

        <ModuleBlock title={pendingLabel} accent="orange">
          <ul className={styles.list}>
            {status.notSubmitted.map((student) => (
              <li key={student.studentId} className={styles.studentRow}>
                <p className={styles.studentName}>{student.name}</p>
                <p className={styles.studentMeta}>{student.email || `ID ${student.studentId}`}</p>
              </li>
            ))}
            {!status.notSubmitted.length && !loading ? (
              <li className={styles.studentRow}>Everyone has submitted.</li>
            ) : null}
          </ul>
        </ModuleBlock>
      </div>
    </div>
  );
}

export default CompletionStatus;
