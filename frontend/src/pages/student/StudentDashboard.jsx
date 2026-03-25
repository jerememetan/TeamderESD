import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, FileText, Users, Clock } from 'lucide-react';
import ModuleBlock from '../../components/schematic/ModuleBlock';
import SystemTag from '../../components/schematic/SystemTag';
import motionStyles from '../../components/schematic/motion.module.css';
import { currentStudent, currentStudentTeams, mockCourses, mockForms } from '../../data/mockData';
import { fetchStudentAssignments } from '../../services/studentAssignmentService';
import { getPendingPeerEvaluations } from '../../services/peerEvaluationService';
import styles from './StudentDashboard.module.css';

function StudentDashBoard() {
  const studentProfile = currentStudent;
  const [teamAssignments, setTeamAssignments] = useState(currentStudentTeams);
  const [assignmentSource, setAssignmentSource] = useState('mock');
  const [assignmentError, setAssignmentError] = useState('');
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
  const [pendingPeerRounds, setPendingPeerRounds] = useState([]);

  useEffect(() => {
    let isMounted = true;

    async function loadAssignments() {
      setIsLoadingAssignments(true);
      setAssignmentError('');

      try {
        const backendAssignments = await fetchStudentAssignments({
          currentStudentId: studentProfile.id,
          courses: mockCourses,
        });

        if (!isMounted) {
          return;
        }

        if (backendAssignments.length) {
          setTeamAssignments(backendAssignments);
          setAssignmentSource('backend');
          const groupIds = new Set(backendAssignments.map((team) => team.groupId));
          setPendingPeerRounds(getPendingPeerEvaluations({ studentEmail: studentProfile.email, groupIds }));
        } else {
          setTeamAssignments(currentStudentTeams);
          setAssignmentSource('mock');
          const groupIds = new Set(currentStudentTeams.map((team) => team.groupId));
          setPendingPeerRounds(getPendingPeerEvaluations({ studentEmail: studentProfile.email, groupIds }));
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setTeamAssignments(currentStudentTeams);
        setAssignmentSource('mock');
        setAssignmentError(error.message);
        const groupIds = new Set(currentStudentTeams.map((team) => team.groupId));
        setPendingPeerRounds(getPendingPeerEvaluations({ studentEmail: studentProfile.email, groupIds }));
      } finally {
        if (isMounted) {
          setIsLoadingAssignments(false);
        }
      }
    }

    loadAssignments();

    return () => {
      isMounted = false;
    };
  }, [studentProfile.email, studentProfile.id]);

  const groupIds = new Set(teamAssignments.map((team) => team.groupId));
  const availableFormList = Object.values(mockForms).filter((form) => groupIds.has(form.groupId));
  const nextForm = availableFormList[0] || null;
  const pendingConfirmations = useMemo(
    () => teamAssignments.filter((team) => team.members.some((member) => (member.id === studentProfile.id || member.studentId === studentProfile.studentId || member.email === studentProfile.email) && member.confirmationStatus === 'pending')).length,
    [studentProfile.email, studentProfile.id, studentProfile.studentId, teamAssignments],
  );
  const assignmentTone = assignmentError ? 'alert' : assignmentSource === 'backend' ? 'success' : 'neutral';
  const nextPeerRound = pendingPeerRounds[0] || null;

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <section className={`${styles.hero} ${motionStyles.staggerItem}`} style={{ '--td-stagger-delay': '0ms' }}>
        <div>
          <h2 className={styles.title}>Student Dashboard</h2>
          <p className={styles.subtitle}>Welcome back, {studentProfile.name}. You are currently assigned to {teamAssignments.length} course group{teamAssignments.length > 1 ? 's' : ''}.</p>
        </div>
        <SystemTag tone={assignmentTone}>{isLoadingAssignments ? 'Loading assignments' : assignmentSource === 'backend' ? 'Backend teams loaded' : 'Mock assignments active'}</SystemTag>
      </section>
      <section className={styles.statsGrid}>
        {[
          { title: 'My Teams', metric: String(teamAssignments.length).padStart(2, '0'), accent: 'blue' },
          { title: 'Available Forms', metric: String(availableFormList.length).padStart(2, '0'), accent: 'green' },
          { title: 'Peer Evaluations', metric: String(pendingPeerRounds.length).padStart(2, '0'), accent: 'orange' },
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
            style={{ '--td-stagger-delay': `${(index + 1) * 50}ms` }}
          />
        ))}
      </section>

      <section className={styles.actionGrid}> 
        {[
          {
            to: '/student/team',
            icon: <Users className={styles.actionIcon} />,
            code: 'Quick Link',
            title: 'View My Teams',
            text: 'See every team you have been assigned to and confirm your place.',
          },
          {
            to: nextForm ? `/student/form/${nextForm.id}` : '/student',
            icon: <FileText className={styles.actionIcon} />,
            code: 'Quick Link',
            title: 'Fill In A Form',
            text: 'Open one of your group forms and submit your answers.',
          },
          {
            to: nextPeerRound ? `/student/peer-evaluation/${nextPeerRound.id}` : '/student',
            icon: <FileText className={styles.actionIcon} />,
            code: 'Peer Review',
            title: 'Complete Peer Evaluation',
            text: nextPeerRound ? 'Rate your teammates and yourself for the final project review.' : 'No peer evaluation rounds are active right now.',
          },
        ].map((action, index) => (
          <Link
            key={action.code + index}
            to={action.to}
            className={`${styles.actionCard} ${motionStyles.staggerItem} ${motionStyles.magneticItem} ${!nextPeerRound && action.code === 'Peer Review' ? styles.actionCardDisabled : ''}`}
            style={{ '--td-stagger-delay': `${(index + 4) * 50}ms` }}
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

      <ModuleBlock
        componentId="MOD-15"
        eyebrow="Recent Activity"
        title="Form History"
        className={`${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
        style={{ '--td-stagger-delay': '350ms' }}
      >
        <div className={styles.historyState}>
          <Clock className={styles.historyIcon} />
          <div>
            <p className={styles.historyTitle}>Latest submission</p>
            <p className={styles.historyText}>Team Formation Survey completed on March 5, 2026.</p>
          </div>
        </div>
      </ModuleBlock>
    </div>
  );
}

export default StudentDashBoard;
