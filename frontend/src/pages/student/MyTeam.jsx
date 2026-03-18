import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Mail, RefreshCw } from "lucide-react";
import GroupChip from "../../components/schematic/GroupChip";
import ModuleBlock from "../../components/schematic/ModuleBlock";
import SystemTag from "../../components/schematic/SystemTag";
import motionStyles from "../../components/schematic/motion.module.css";
import { currentStudent, currentStudentTeam, mockCourses, mockStudentStrengths } from "../../data/mockData";
import styles from "./MyTeam.module.css";

function MyTeam() {
  const studentProfile = currentStudent;
  const activeTeam = currentStudentTeam;
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapReason, setSwapReason] = useState("");

  const selectedCourse = mockCourses.find((course) => course.id === activeTeam.courseId);
  const selectedGroup = selectedCourse?.groups.find((group) => group.id === activeTeam.groupId);

  const getStrongestCriteria = (studentId) => mockStudentStrengths[studentId] || ["Teamwork", "General contribution"];

  const handleSubmitSwapRequest = (event) => {
    event.preventDefault();
    console.log("Swap request:", {
      currentTeamId: activeTeam.id,
      courseId: activeTeam.courseId,
      groupId: activeTeam.groupId,
      reason: swapReason,
    });
    alert("Swap request submitted successfully!");
    setShowSwapModal(false);
    setSwapReason("");
  };

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <Link to="/student" className={styles.backLink}><ArrowLeft className={styles.backIcon} /> Return to student console</Link>

      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>[TEAM MEMBER CONSOLE]</p>
          <h2 className={styles.title}>{activeTeam.name} assignment and teammate signals</h2>
          <p className={styles.subtitle}>{selectedCourse?.name} :: {selectedGroup?.code || 'Unassigned group'} :: use this screen to understand current team composition.</p>
        </div>
        <button onClick={() => setShowSwapModal(true)} className={styles.primaryButton}><RefreshCw className={styles.buttonIcon} /> Request team swap</button>
      </section>

      <section className={styles.statsGrid}>
        {[
          { id: 'MOD-M1', eyebrow: 'Group', title: 'Teaching Group', metric: selectedGroup?.code || 'NA', label: 'Linked group context', accent: 'blue' },
          { id: 'MOD-M2', eyebrow: 'Roster', title: 'Team Members', metric: activeTeam.members.length, label: 'Students in current team', accent: 'green' },
          { id: 'MOD-M3', eyebrow: 'Course', title: 'Course Code', metric: selectedCourse?.code || 'UNK', label: 'Owning course container', accent: 'blue' },
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
            style={{ '--td-stagger-delay': `${index * 50}ms` }}
          />
        ))}
      </section>

      <ModuleBlock componentId="MOD-M4" eyebrow="Team Identity" title={activeTeam.name} metric={activeTeam.formationScore} metricLabel="Formation score" className={motionStyles.staggerItem} style={{ '--td-stagger-delay': '150ms' }}>
        <div className={styles.teamHeader}>
          <GroupChip code={selectedGroup?.code || activeTeam.groupId} meta={`${activeTeam.members.length} members`} tone="green" className={motionStyles.magneticItem} />
          <SystemTag tone="success">Stable assignment</SystemTag>
        </div>
        <div className={styles.memberList}>
          {activeTeam.members.map((member, index) => {
            const strongestCriteria = getStrongestCriteria(member.id);
            const isCurrentUser = member.id === studentProfile.id;

            return (
              <div key={member.id} className={`${styles.memberCard} ${isCurrentUser ? styles.memberCardActive : ''} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`} style={{ '--td-stagger-delay': `${index * 50}ms` }}>
                <div className={styles.memberIdentity}>
                  <div className={styles.memberAvatar}>{member.name.charAt(0)}</div>
                  <div>
                    <p className={styles.memberName}>{member.name} {isCurrentUser ? <span className={styles.youTag}>[YOU]</span> : null}</p>
                    <p className={styles.memberMeta}>{member.studentId}</p>
                  </div>
                </div>
                <div className={styles.memberDetail}>
                  <div className={styles.mailLine}><Mail className={styles.mailIcon} /> <span>{member.email}</span></div>
                  <div className={styles.tagRow}>
                    {strongestCriteria.map((criterion, tagIndex) => (
                      <SystemTag key={criterion} tone="neutral" className={motionStyles.staggerItem} style={{ '--td-stagger-delay': `${(index + tagIndex) * 50}ms` }}>{criterion}</SystemTag>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </ModuleBlock>

      {showSwapModal ? (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalCard} ${motionStyles.motionPage}`}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalCode}>[SWAP REQUEST CHANNEL]</p>
                <h3 className={styles.modalTitle}>Request team reassignment</h3>
              </div>
              <SystemTag hazard>Instructor review required</SystemTag>
            </div>
            <form onSubmit={handleSubmitSwapRequest} className={styles.modalForm}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Reason for intervention</span>
                <textarea
                  value={swapReason}
                  onChange={(event) => setSwapReason(event.target.value)}
                  rows={5}
                  className={styles.textarea}
                  placeholder="Explain why you would like to swap teams..."
                  required
                />
              </label>
              <div className={styles.modalActions}>
                <button type="submit" className={styles.primaryButton}>Submit request</button>
                <button type="button" onClick={() => { setShowSwapModal(false); setSwapReason(""); }} className={styles.secondaryButton}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default MyTeam;
