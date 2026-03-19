import { Link } from 'react-router';
import { FileText, Users, Clock } from 'lucide-react';
import ModuleBlock from '../../components/schematic/ModuleBlock';
import SystemTag from '../../components/schematic/SystemTag';
import motionStyles from '../../components/schematic/motion.module.css';
import { currentStudent, currentStudentTeams, mockCourses, mockForms } from '../../data/mockData';
import styles from './StudentDashboard.module.css';

function StudentDashBoard() {
  const studentProfile = currentStudent;
  const teamAssignments = currentStudentTeams;
  const groupIds = new Set(teamAssignments.map((team) => team.groupId));
  const availableFormList = Object.values(mockForms).filter((form) => groupIds.has(form.groupId));
  const nextForm = availableFormList[0] || null;

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <section className={`${styles.hero} ${motionStyles.staggerItem}`} style={{ '--td-stagger-delay': '0ms' }}>
        <div>
          <p className={styles.kicker}>[STUDENT HOME]</p>
          <h2 className={styles.title}>See your teams and complete your forms.</h2>
          <p className={styles.subtitle}>Welcome back, {studentProfile.name}. You are currently assigned to {teamAssignments.length} course group{teamAssignments.length > 1 ? 's' : ''}.</p>
        </div>
        <SystemTag tone="success">Assignments ready to review</SystemTag>
      </section>

      <section className={styles.statsGrid}>
        {[
          { id: 'MOD-11', eyebrow: 'Overview', title: 'My Teams', metric: String(teamAssignments.length).padStart(2, '0'), label: 'One team per course group', accent: 'blue' },
          { id: 'MOD-12', eyebrow: 'Overview', title: 'Available Forms', metric: String(availableFormList.length).padStart(2, '0'), label: 'Forms you can fill in', accent: 'green' },
          { id: 'MOD-13', eyebrow: 'Attention', title: 'Pending Confirmations', metric: String(teamAssignments.filter((team) => team.members.some((member) => member.id === studentProfile.id && member.confirmationStatus === 'pending')).length).padStart(2, '0'), label: 'Teams waiting for your confirmation', accent: 'orange' },
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
        ].map((action, index) => (
          <Link
            key={action.code + index}
            to={action.to}
            className={`${styles.actionCard} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
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
        componentId="MOD-14"
        eyebrow="Assignments"
        title="Current Team Assignments"
        className={`${styles.teamModule} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
        style={{ '--td-stagger-delay': '300ms' }}
      >
        <div className={styles.assignmentList}>
          {teamAssignments.map((team) => {
            const course = mockCourses.find((item) => item.id === team.courseId);
            const currentMember = team.members.find((member) => member.id === studentProfile.id);

            return (
              <div key={team.id} className={styles.assignmentRow}>
                <p className={styles.assignmentTitle}>You have been assigned to {team.name}.</p>
                <p className={styles.metaLine}>{course?.code} :: {team.groupId} :: {team.members.length} members</p>
                <SystemTag tone={currentMember?.confirmationStatus === 'confirmed' ? 'success' : 'alert'}>
                  {currentMember?.confirmationStatus === 'confirmed' ? 'Confirmed' : 'Waiting for your confirmation'}
                </SystemTag>
              </div>
            );
          })}
        </div>
      </ModuleBlock>

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
