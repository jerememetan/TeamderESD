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
          <p className={styles.kicker}>[STUDENT HOME]</p>
          <h2 className={styles.title}>See your team and complete your form.</h2>
          <p className={styles.subtitle}>Welcome back, {studentProfile.name}. You are in {activeTeam.name} for group {activeTeam.groupId}.</p>
        </div>
        <SystemTag tone="success">Form ready for your group</SystemTag>
      </section>

      <section className={styles.statsGrid}>
        {[
          { id: 'MOD-11', eyebrow: 'Overview', title: 'My Team', metric: '01', label: 'Current team', accent: 'blue' },
          { id: 'MOD-12', eyebrow: 'Overview', title: 'Available Forms', metric: String(availableFormList.length).padStart(2, '0'), label: 'Forms you can fill in', accent: 'green' },
          { id: 'MOD-13', eyebrow: 'Attention', title: 'Pending Swaps', metric: '00', label: 'Requests still waiting', accent: 'orange' },
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
            title: 'View My Team',
            text: 'Open your team page to see teammates and request a swap if needed.',
          },
          {
            to: activeForm ? `/student/form/${activeForm.id}` : '/student',
            icon: <FileText className={styles.actionIcon} />,
            code: 'Quick Link',
            title: 'Fill In My Form',
            text: 'Open the form for your group and submit your answers.',
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
        eyebrow="Details"
        title={activeTeam.name}
        metric={activeTeam.formationScore}
        metricLabel="Team score"
        className={`${styles.teamModule} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`}
        style={{ '--td-stagger-delay': '300ms' }}
      >
        <div className={styles.teamMeta}>
          <p className={styles.metaLine}>Members :: {activeTeam.members.length}</p>
          <p className={styles.metaLine}>Form for :: {activeForm?.groupId || activeTeam.groupId}</p>
          <p className={styles.metaLine}>{activeForm ? 'You can submit your form now' : 'No form is linked yet'}</p>
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
