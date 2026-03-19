import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, CheckCircle, Mail, Users, XCircle } from "lucide-react";
import GroupChip from "../../components/schematic/GroupChip";
import ModuleBlock from "../../components/schematic/ModuleBlock";
import SystemTag from "../../components/schematic/SystemTag";
import motionStyles from "../../components/schematic/motion.module.css";
import { mockCourses, mockSwapRequests, mockTeams } from "../../data/mockData";
import styles from "./Teams.module.css";

function Teams() {
  const { courseId } = useParams();
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [swapRequestList, setSwapRequestList] = useState(mockSwapRequests);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const selectedCourse = mockCourses.find((course) => course.id === courseId);
  const courseTeams = mockTeams.filter((team) => team.courseId === courseId);
  const selectedTeam = courseTeams.find((team) => team.id === selectedTeamId) || courseTeams[0] || null;

  const pendingRequestMap = useMemo(
    () => Object.fromEntries(
      swapRequestList
        .filter((request) => request.status === "pending")
        .map((request) => [request.studentId, request]),
    ),
    [swapRequestList],
  );

  if (!selectedCourse) {
    return <div className={styles.notFound}>Course not found</div>;
  }

  const handleApprove = (requestId) => {
    setSwapRequestList((currentRequests) => currentRequests.map((request) => request.id === requestId ? { ...request, status: "approved" } : request));
    setSelectedRequest((currentRequest) => currentRequest?.id === requestId ? { ...currentRequest, status: "approved" } : currentRequest);
  };

  const handleReject = (requestId) => {
    setSwapRequestList((currentRequests) => currentRequests.map((request) => request.id === requestId ? { ...request, status: "rejected" } : request));
    setSelectedRequest((currentRequest) => currentRequest?.id === requestId ? { ...currentRequest, status: "rejected" } : currentRequest);
  };

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <Link to="/instructor/courses" className={styles.backLink}><ArrowLeft className={styles.backIcon} /> Return to course matrix</Link>

      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>[TEAM VIEW]</p>
          <h2 className={styles.title}>{selectedCourse.code} teams</h2>
          <p className={styles.subtitle}>See each team, check whether students have confirmed, and review swap requests.</p>
        </div>
        <SystemTag hazard>{swapRequestList.filter((request) => request.status === 'pending').length} pending interventions</SystemTag>
      </section>

      <div className={styles.layout}>
        <ModuleBlock componentId="MOD-T1" eyebrow="Teams" title={`All Teams :: ${courseTeams.length}`} className={`${styles.sideModule} ${motionStyles.staggerItem}`} style={{ '--td-stagger-delay': '0ms' }}>
          <div className={styles.teamList}>
            {courseTeams.map((team, index) => {
              const hasPendingRequest = team.members.some((member) => pendingRequestMap[member.id]);
              const isTeamConfirmed = team.members.every((member) => member.confirmationStatus === 'confirmed');
              return (
                <button key={team.id} onClick={() => setSelectedTeamId(team.id)} className={`${styles.teamSelect} ${selectedTeam?.id === team.id ? styles.teamSelectActive : ''} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`} style={{ '--td-stagger-delay': `${index * 50}ms` }}>
                  <div className={styles.teamSelectHeader}>
                    <p className={`${styles.teamCode} ${isTeamConfirmed ? styles.teamCodeConfirmed : styles.teamCodePending}`}>{team.name}</p>
                    {hasPendingRequest ? <SystemTag hazard>Pending swap</SystemTag> : null}
                  </div>
                  <p className={styles.teamMeta}>{team.groupId} :: {team.members.length} members</p>
                  <SystemTag tone={isTeamConfirmed ? 'success' : 'alert'}>
                    {isTeamConfirmed ? 'All members confirmed' : 'Waiting for confirmations'}
                  </SystemTag>
                </button>
              )
            })}
          </div>
        </ModuleBlock>

        <div className={styles.mainColumn}>
          {selectedTeam ? (
            <ModuleBlock
              componentId="MOD-T2"
              eyebrow="Selected Team"
              title={<span className={selectedTeam.members.every((member) => member.confirmationStatus === 'confirmed') ? styles.teamCodeConfirmed : styles.teamCodePending}>{selectedTeam.name}</span>}
              metric={selectedTeam.members.length}
              metricLabel="Members in this team"
              className={`${motionStyles.staggerItem}`}
              style={{ '--td-stagger-delay': '100ms' }}
            >
              <div className={styles.teamSummary}>
                <GroupChip code={selectedTeam.groupId} meta={`${selectedTeam.members.length} members`} tone={selectedTeam.members.every((member) => member.confirmationStatus === 'confirmed') ? 'green' : 'orange'} className={motionStyles.magneticItem} />
                <SystemTag tone={selectedTeam.members.every((member) => member.confirmationStatus === 'confirmed') ? 'success' : 'alert'}>
                  {selectedTeam.members.every((member) => member.confirmationStatus === 'confirmed') ? 'Team confirmed' : 'Waiting for confirmations'}
                </SystemTag>
              </div>
              <div className={styles.memberList}>
                {selectedTeam.members.map((member, index) => {
                  const pendingRequest = pendingRequestMap[member.id];

                  return (
                    <div key={member.id} className={`${styles.memberCard} ${pendingRequest ? styles.memberCardAlert : ''} ${motionStyles.staggerItem} ${motionStyles.magneticItem}`} style={{ '--td-stagger-delay': `${index * 50}ms` }}>
                      <div className={styles.memberIdentity}>
                        <div className={styles.memberAvatar}>{member.name.charAt(0)}</div>
                        <div>
                          <p className={`${styles.memberName} ${member.confirmationStatus === 'confirmed' ? styles.memberNameConfirmed : styles.memberNamePending}`}>{member.name}</p>
                          <p className={styles.memberMeta}>{member.studentId}</p>
                        </div>
                      </div>
                      <div className={styles.memberActions}>
                        <SystemTag tone={member.confirmationStatus === 'confirmed' ? 'success' : 'alert'}>
                          {member.confirmationStatus === 'confirmed' ? 'Confirmed' : 'Pending'}
                        </SystemTag>
                        <div className={styles.mailLine}><Mail className={styles.mailIcon} /> <span>{member.email}</span></div>
                        {pendingRequest ? <button onClick={() => setSelectedRequest(pendingRequest)} className={`${styles.alertButton} ${motionStyles.pulseWarning}`}>See swap request</button> : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ModuleBlock>
          ) : (
            <ModuleBlock componentId="MOD-T0" eyebrow="Selection" title="No team selected" metric="00" metricLabel="Visible team members" className={motionStyles.staggerItem} style={{ '--td-stagger-delay': '100ms' }} />
          )}
        </div>
      </div>

      {selectedRequest ? (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalCard} ${motionStyles.motionPage}`}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalCode}>[SWAP REQUEST]</p>
                <h3 className={styles.modalTitle}>{selectedRequest.studentName} from {selectedRequest.currentTeamName}</h3>
              </div>
              {selectedRequest.status === 'pending' ? <SystemTag hazard>Pending review</SystemTag> : selectedRequest.status === 'approved' ? <SystemTag tone="success">Approved</SystemTag> : <SystemTag tone="alert">Rejected</SystemTag>}
            </div>
            <div className={styles.reasonBox}>
              <p className={styles.reasonLabel}>Reason</p>
              <p className={styles.reasonText}>{selectedRequest.reason}</p>
            </div>
            <div className={styles.modalActions}>
              {selectedRequest.status === 'pending' ? (
                <>
                  <button onClick={() => handleApprove(selectedRequest.id)} className={styles.successButton}><CheckCircle className={styles.actionIcon} /> Approve</button>
                  <button onClick={() => handleReject(selectedRequest.id)} className={`${styles.alertButton} ${motionStyles.pulseWarning}`}><XCircle className={styles.actionIcon} /> Reject</button>
                </>
              ) : null}
              <button onClick={() => setSelectedRequest(null)} className={styles.secondaryButton}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Teams;
