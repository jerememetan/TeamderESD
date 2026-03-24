import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import ModuleBlock from "../../components/schematic/ModuleBlock";
import SystemTag from "../../components/schematic/SystemTag";
import motionStyles from "../../components/schematic/motion.module.css";
import { currentStudent, currentStudentTeams, mockCourses } from "../../data/mockData";
import { fetchStudentAssignments } from "../../services/studentAssignmentService";
import { getPeerEvaluationRound, getPeerEvaluationSubmission, submitPeerEvaluation } from "../../services/peerEvaluationService";
import styles from "./PeerEvaluationForm.module.css";

function PeerEvaluationForm() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const studentProfile = currentStudent;
  const [teamAssignments, setTeamAssignments] = useState(currentStudentTeams);
  const [responses, setResponses] = useState({});
  const [assignmentSource, setAssignmentSource] = useState("mock");

  useEffect(() => {
    let isMounted = true;

    async function loadAssignments() {
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
          setAssignmentSource("backend");
        } else {
          setTeamAssignments(currentStudentTeams);
          setAssignmentSource("mock");
        }
      } catch {
        if (isMounted) {
          setTeamAssignments(currentStudentTeams);
          setAssignmentSource("mock");
        }
      }
    }

    loadAssignments();

    return () => {
      isMounted = false;
    };
  }, [studentProfile.id]);

  const round = getPeerEvaluationRound(roundId || "");
  const existingSubmission = round ? getPeerEvaluationSubmission(round.id, studentProfile.email) : null;
  const activeAssignment = teamAssignments.find((team) => team.groupId === round?.groupId) || teamAssignments[0] || null;
  const selectedCourse = mockCourses.find((course) => course.id === activeAssignment?.courseId);
  const selectedGroup = selectedCourse?.groups.find((group) => group.id === activeAssignment?.groupId);

  const memberList = useMemo(() => activeAssignment?.members ?? [], [activeAssignment]);

  if (!round || !activeAssignment) {
    return <div className={styles.notFound}>Peer evaluation round not available.</div>;
  }

  if (existingSubmission) {
    return (
      <div className={styles.page}>
        <Link to="/student" className={styles.backLink}><ArrowLeft className={styles.backIcon} /> Return to student console</Link>
        <ModuleBlock componentId="MOD-PDONE" eyebrow="Peer Evaluation" title="Submission received" metric="DONE" metricLabel="Your evaluation has been recorded">
          <p className={styles.infoText}>You have already completed this peer evaluation round. Reputation effects remain private and are not shown here.</p>
          <div className={styles.actionRow}>
            <button type="button" onClick={() => navigate('/student')} className={styles.primaryButton}>Return to dashboard</button>
          </div>
        </ModuleBlock>
      </div>
    );
  }

  const handleChange = (memberEmail, field, value) => {
    setResponses((current) => ({
      ...current,
      [memberEmail]: {
        ...current[memberEmail],
        memberName: memberList.find((member) => member.email === memberEmail)?.name || memberEmail,
        [field]: value,
      },
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const entries = memberList.map((member) => ({
      memberEmail: member.email,
      memberName: member.name,
      rating: Number(responses[member.email]?.rating || 0),
      justification: responses[member.email]?.justification || "",
    }));

    submitPeerEvaluation({
      roundId: round.id,
      studentEmail: studentProfile.email,
      teamId: activeAssignment.id,
      entries,
    });

    alert("Peer evaluation submitted successfully.");
    navigate('/student');
  };

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <Link to="/student" className={styles.backLink}><ArrowLeft className={styles.backIcon} /> Return to student console</Link>

      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>[PEER EVALUATION]</p>
          <h2 className={styles.title}>{selectedGroup?.code || activeAssignment.groupId} peer evaluation</h2>
          <p className={styles.subtitle}>Rate each teammate and yourself from 1 to 5, then add a short justification. Reputation impact is private and will not be shown to students.</p>
        </div>
        <div className={styles.heroTags}>
          <SystemTag tone="success">Round active</SystemTag>
          <SystemTag tone="neutral">Due {new Date(round.dueAt).toLocaleDateString()}</SystemTag>
        </div>
      </section>

      <p className={styles.infoText}>Current team source: {assignmentSource === 'backend' ? 'assigned team loaded from backend roster and team data' : 'mock fallback team assignment'}</p>

      <form onSubmit={handleSubmit} className={styles.form}>
        {memberList.map((member, index) => (
          <ModuleBlock key={member.email} componentId={`MOD-PE${index + 1}`} eyebrow={member.email === studentProfile.email ? 'Self Review' : 'Peer Review'} title={member.email === studentProfile.email ? `Rate yourself :: ${member.name}` : `Rate ${member.name}`}>
            <div className={styles.memberHeader}>
              <p className={styles.memberMeta}>{member.studentId}</p>
              <SystemTag tone={member.email === studentProfile.email ? 'neutral' : 'success'}>{member.email === studentProfile.email ? 'Self evaluation' : 'Teammate evaluation'}</SystemTag>
            </div>
            <div className={styles.scaleGrid}>
              {[1, 2, 3, 4, 5].map((score) => (
                <label key={score} className={`${styles.scoreCard} ${Number(responses[member.email]?.rating || 0) === score ? styles.scoreCardActive : ''}`}>
                  <input
                    type="radio"
                    name={`rating-${member.email}`}
                    value={score}
                    checked={Number(responses[member.email]?.rating || 0) === score}
                    onChange={() => handleChange(member.email, 'rating', score)}
                    className={styles.hiddenInput}
                    required
                  />
                  <span className={styles.scoreValue}>{score}</span>
                  <span className={styles.scoreLabel}>Rating</span>
                </label>
              ))}
            </div>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Short justification</span>
              <textarea
                value={responses[member.email]?.justification || ''}
                onChange={(event) => handleChange(member.email, 'justification', event.target.value)}
                rows={4}
                className={styles.textarea}
                placeholder={member.email === studentProfile.email ? 'Briefly explain how you contributed to the team.' : 'Briefly explain why you chose this rating.'}
                required
              />
            </label>
          </ModuleBlock>
        ))}

        <div className={styles.actionRow}>
          <button type="submit" className={styles.primaryButton}>Submit peer evaluation</button>
          <button type="button" onClick={() => navigate('/student')} className={styles.secondaryButton}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default PeerEvaluationForm;
