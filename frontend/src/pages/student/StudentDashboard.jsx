import { Link } from 'react-router';
import { FileText, Users, Clock } from 'lucide-react';
import ModuleBlock from '../../components/schematic/ModuleBlock';
import SystemTag from '../../components/schematic/SystemTag';
import motionStyles from '../../components/schematic/motion.module.css';
import { currentStudent, currentStudentTeam, mockForms } from '../../data/mockData';
import styles from './StudentDashboard.module.css';

function StudentDashBoard() {
  const studentProfile = currentStudent;
  const activeTeam = currentStudentTeam;
  const availableFormList = Object.values(mockForms).filter((form) => form.groupId === activeTeam.groupId);
  const activeForm = availableFormList[0] || null;

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <section className={`${styles.hero} ${motionStyles.staggerItem}`} style={{ '--td-stagger-delay': '0ms' }}>
        <div>
          <p className={styles.kicker}>[STUDENT TEAM STATION]</p>
          <h2 className={styles.title}>Track your team assignment and complete your group form.</h2>
          <p className={styles.subtitle}>Active team: {activeTeam.name} :: Group {activeTeam.groupId} :: Operator {studentProfile.studentId}</p>
        </div>
        <SystemTag tone="success">Group link locked</SystemTag>
      </section>

      <section className={styles.statsGrid}>
        {[
          { id: 'MOD-11', eyebrow: 'Assignment', title: 'Active Team', metric: '01', label: 'Current placement', accent: 'blue' },
          { id: 'MOD-12', eyebrow: 'Form Access', title: 'Group Forms', metric: String(availableFormList.length).padStart(2, '0'), label: 'Visible to your group', accent: 'green' },
          { id: 'MOD-13', eyebrow: 'Request Queue', title: 'Pending Swaps', metric: '00', label: 'Awaiting instructor action', accent: 'orange' },
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
            code: '[ACT-TEAM]',
            title: 'Inspect Team Module',
            text: 'Review teammates, strengths, and swap-request controls.',
          },
          {
            to: activeForm ? `/student/form/${activeForm.id}` : '/student',
            icon: <FileText className={styles.actionIcon} />,
            code: '[ACT-FORM]',
            title: 'Open Group Form',
            text: 'Submit responses for the form linked specifically to your assigned group.',
          },
        ].map((action, index) => (
          <Link
            key={action.code}
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
        eyebrow="Current Linkage"
        title={activeTeam.name}
        metric={activeTeam.formationScore}
        metricLabel="Formation score"
        className={`${styles.teamModule} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
        style={{ '--td-stagger-delay': '300ms' }}
      >
        <div className={styles.teamMeta}>
          <p className={styles.metaLine}>Members :: {activeTeam.members.length}</p>
          <p className={styles.metaLine}>Form linkage :: {activeForm?.groupId || activeTeam.groupId}</p>
          <p className={styles.metaLine}>Availability :: {activeForm ? 'Published to group' : 'No form linked yet'}</p>
        </div>
      </ModuleBlock>

      <ModuleBlock
        componentId="MOD-15"
        eyebrow="Historical Record"
        title="Submission Timeline"
        className={`${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
        style={{ '--td-stagger-delay': '350ms' }}
      >
        <div className={styles.historyState}>
          <Clock className={styles.historyIcon} />
          <div>
            <p className={styles.historyTitle}>Latest entry recorded</p>
            <p className={styles.historyText}>Team Formation Survey completed on March 5, 2026.</p>
          </div>
        </div>
      </ModuleBlock>
    </div>
  );
}

export default StudentDashBoard;
