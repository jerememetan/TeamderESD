import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import ModuleBlock from "../../components/schematic/ModuleBlock";
import SystemTag from "../../components/schematic/SystemTag";
import motionStyles from "../../components/schematic/motion.module.css";
import StudentSwitcher from "../../components/student/StudentSwitcher";
import { useStudentSession } from "../../services/studentSession";
import {
  getPeerEvaluationRound,
  getPeerEvaluationSubmission,
  submitPeerEvaluation,
} from "../../services/peerEvaluationService";
import { fetchTeamsBySection } from "../../services/teamService";
import { fetchAllStudents, buildStudentMapByBackendId } from "../../services/studentService";
import styles from "./PeerEvaluationForm.module.css";
import { Button } from "../../components/ui/button";

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

  const [round, setRound] = useState(null);
  const [teams, setTeams] = useState([]);
  const [studentsByBackendId, setStudentsByBackendId] = useState(new Map());
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [responses, setResponses] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Determine the current student's backend ID from available students
  const currentBackendId = useMemo(() => activeStudent?.backendStudentId ?? null, [activeStudent]);

  // Load round, teams, and profiles
  useEffect(() => {
    let isMounted = true;

    async function loadAll() {
      setIsLoading(true);
      try {
        const fetchedRound = await getPeerEvaluationRound(roundId || "");
        if (!isMounted) return;
        setRound(fetchedRound);

        if (!fetchedRound || !fetchedRound.sectionId) {
          setIsLoading(false);
          return;
        }

        let sectionTeams = [];
        try {
          sectionTeams = await fetchTeamsBySection(fetchedRound.sectionId);
        } catch (err) {
          console.error("Failed to fetch teams:", err);
        }
        if (!isMounted) return;
        setTeams(sectionTeams);

        let students = [];
        try {
          students = await fetchAllStudents();
        } catch (err) {
          console.error("Failed to fetch students:", err);
        }
        if (!isMounted) return;
        setStudentsByBackendId(buildStudentMapByBackendId(students));

        if (currentBackendId) {
          const submission = await getPeerEvaluationSubmission(
            fetchedRound.id,
            currentBackendId
          );
          if (isMounted) setExistingSubmission(submission);
        }
      } catch (err) {
        console.error("Failed to load peer eval data:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadAll();
    return () => { isMounted = false; };
  }, [roundId, currentBackendId]);

  const myTeam = useMemo(() => {
    if (!currentBackendId) return null;
    return teams.find((team) =>
      (team.students || []).some((s) => s.student_id === currentBackendId)
    ) || null;
  }, [teams, currentBackendId]);

  const memberList = useMemo(() => {
    if (!myTeam) return [];
    return (myTeam.students || []).map((s) => {
      const studentRecord = studentsByBackendId.get(Number(s.student_id));
      return {
        id: String(s.student_id),
        name: String(studentRecord?.name || "").trim() || `Student ${s.student_id}`,
        email: String(studentRecord?.email || "").trim() || "No email",
        studentId: `ID-${s.student_id}`,
      };
    });
  }, [myTeam, studentsByBackendId]);

  const teammates = useMemo(
    () => memberList.filter((m) => m.id !== String(currentBackendId)),
    [memberList, currentBackendId]
  );

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

  const handleChange = (memberId, field, value) => {
    setResponses((current) => ({
      ...current,
      [memberId]: {
        ...current[memberId],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");

    const entries = teammates.map((member) => ({
      evaluateeId: parseInt(member.id, 10),
      rating: Number(responses[member.id]?.rating || 0),
      justification: responses[member.id]?.justification || "",
    }));

    if (entries.some((e) => !e.rating)) {
      setSubmitError("Please rate all teammates before submitting.");
      setIsSubmitting(false);
      return;
    }

    try {
      await submitPeerEvaluation({
        roundId: round.id,
        evaluatorId: currentBackendId,
        teamId: myTeam.team_id,
        entries,
      });

      navigate(studentBasePath);
    } catch (err) {
      setSubmitError(
        err.message || "Failed to submit evaluation. Please try again."
      );
    } finally {
      setIsSubmitting(false);
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
                    onChange={() => handleChange(member.id, "rating", score)}
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
                  handleChange(member.id, "justification", event.target.value)
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
