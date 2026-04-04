import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import ModuleBlock from "../../../components/schematic/ModuleBlock";
import SystemTag from "../../../components/schematic/SystemTag";
import motionStyles from "../../../components/schematic/motion.module.css";
import StudentSwitcher from "../../../components/student/StudentSwitcher";
import { useStudentSession } from "../../../services/studentSession";
import { usePeerEvaluationForm } from "./logic/usePeerEvaluationForm";
import styles from "./PeerEvaluationForm.module.css";
import { Button } from "../../../components/ui/button";

function PeerEvaluationForm() {
  const { roundId, studentId: routeStudentId } = useParams();
  const navigate = useNavigate();
  const {
    activeStudent,
    activeStudentRouteId,
    availableStudents,
    studentLoadError,
    isLoadingStudents,
  } = useStudentSession(routeStudentId);
  const studentBasePath = `/student/${activeStudentRouteId}`;
  const {
    round,
    currentBackendId,
    myTeam,
    memberList,
    teammates,
    existingSubmission,
    responses,
    isLoading,
    isSubmitting,
    submitError,
    updateResponse,
    submitResponses,
  } = usePeerEvaluationForm({
    roundId,
    activeStudent,
    isLoadingStudents,
  });

  if (isLoading || isLoadingStudents) {
    return <div className={styles.notFound}>Loading peer evaluation...</div>;
  }

  if (studentLoadError || !activeStudent) {
    return <div className={styles.notFound}>{studentLoadError || "Backend student data is unavailable."}</div>;
  }

  if (!round) {
    return (
      <div className={styles.notFound}>Peer evaluation round not available.</div>
    );
  }

  if (!myTeam) {
    return (
      <div className={styles.notFound}>
        You are not assigned to a team in this section. Make sure you are
        logged in as a student enrolled in this section.
        <br /><br />
        Current student ID: {currentBackendId || "unknown"}
        <br />
        Available students: {availableStudents.map(s => `${s.name} (${s.id})`).join(", ")}
      </div>
    );
  }

  if (existingSubmission) {
    return (
      <div className={styles.page}>
        <Link to={studentBasePath} className={styles.backLink}>
          <ArrowLeft className={styles.backIcon} /> Return to student console
        </Link>
        <ModuleBlock
          componentId="MOD-PDONE"
          eyebrow="Peer Evaluation"
          title="Submission received"
          metric="DONE"
          metricLabel="Your evaluation has been recorded"
        >
          <p className={styles.infoText}>
            You have already completed this peer evaluation round. Reputation
            effects remain private and are not shown here.
          </p>
          <div className={styles.actionRow}>
            <Button type="button" onClick={() => navigate(studentBasePath)}>
              Return to dashboard
            </Button>
          </div>
        </ModuleBlock>
      </div>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    const success = await submitResponses();
    if (success) {
      navigate(studentBasePath);
    }
  };

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <Link to={studentBasePath} className={styles.backLink}>
        <ArrowLeft className={styles.backIcon} /> Return to student console
      </Link>

      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>[PEER EVALUATION]</p>
          <h2 className={styles.title}>{round.title || "Peer Evaluation"}</h2>
          <p className={styles.subtitle}>
            Rate each teammate from 1 to 5, then add a short justification.
            Reputation impact is private and will not be shown to students.
          </p>
        </div>
        <div className={styles.heroTags}>
          <StudentSwitcher
            activeStudentId={activeStudent.id}
            availableStudents={availableStudents}
            onChange={(nextStudentId) => navigate(`/student/${nextStudentId}/peer-evaluation/${roundId}`)}
          />
          <SystemTag
            tone={round.status === "active" ? "success" : "neutral"}
          >
            {round.status === "active"
              ? "Round active"
              : `Round ${round.status}`}
          </SystemTag>
          {round.dueAt && (
            <SystemTag tone="neutral">
              Due {new Date(round.dueAt).toLocaleDateString()}
            </SystemTag>
          )}
        </div>
      </section>

      <p className={styles.infoText}>
        Evaluating as: {activeStudent?.name} (ID: {currentBackendId}) — Team{" "}
        {myTeam.team_number || "N/A"} ({memberList.length} members)
      </p>

      {submitError && (
        <p style={{ color: "red", padding: "0.5rem 1rem" }}>{submitError}</p>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        {teammates.map((member, index) => (
          <ModuleBlock
            key={member.id}
            componentId={`MOD-PE${index + 1}`}
            eyebrow="Peer Review"
            title={`Rate ${member.name}`}
          >
            <div className={styles.memberHeader}>
              <p className={styles.memberMeta}>{member.email}</p>
              <SystemTag tone="success">Teammate evaluation</SystemTag>
            </div>
            <div className={styles.scaleGrid}>
              {[1, 2, 3, 4, 5].map((score) => (
                <label
                  key={score}
                  className={`${styles.scoreCard} ${
                    Number(responses[member.id]?.rating || 0) === score
                      ? styles.scoreCardActive
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name={`rating-${member.id}`}
                    value={score}
                    checked={
                      Number(responses[member.id]?.rating || 0) === score
                    }
                    onChange={() => updateResponse(member.id, "rating", score)}
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
                value={responses[member.id]?.justification || ""}
                onChange={(event) =>
                  updateResponse(member.id, "justification", event.target.value)
                }
                rows={4}
                className={styles.textarea}
                placeholder="Briefly explain why you chose this rating."
                required
              />
            </label>
          </ModuleBlock>
        ))}

        <div className={styles.actionRow}>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit peer evaluation"}
          </Button>
          <Button
            type="button"
            onClick={() => navigate(studentBasePath)}
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

export default PeerEvaluationForm;
