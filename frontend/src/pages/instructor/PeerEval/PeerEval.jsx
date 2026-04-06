import { useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Play, Square, RefreshCw } from "lucide-react";
import ModuleBlock from "../../../components/schematic/ModuleBlock";
import SystemTag from "../../../components/schematic/SystemTag";
import motionStyles from "../../../components/schematic/motion.module.css";
import { Button } from "../../../components/ui/button";
import { usePeerEvalPage } from "./logic/usePeerEvalPage";
import styles from "./PeerEval.module.css";

function PeerEval() {
  const { courseId, groupId: sectionId } = useParams();
  const {
    selectedCourse,
    selectedGroup,
    students,
    activeRound,
    closedResult,
    totalStudents,
    totalTeams,
    isLoading,
    isInitiating,
    isClosing,
    error,
    actionMessage,
    handleInitiate,
    handleClose,
    refreshRound,
  } = usePeerEvalPage(courseId, sectionId);

  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");

  if (isLoading) {
    return (
      <div className={`${styles.page} ${motionStyles.motionPage}`}>
        <ModuleBlock
          eyebrow="Loading"
          title="Loading peer evaluation"
          metric="..."
          metricLabel="Fetching section and round data"
        />
      </div>
    );
  }

  if (!selectedCourse || !selectedGroup) {
    return <div className={styles.notFound}>Course or section not found.</div>;
  }

  const hasActiveRound = activeRound && activeRound.status === "active";
  const hasClosedRound = activeRound && activeRound.status === "closed";
  const reputationDeltas = closedResult?.reputation_deltas || [];

  const profileLookup = new Map();
  for (const s of students) {
    profileLookup.set(s.student_id, s.profile || {});
  }

  return (
    <div className={`${styles.page} ${motionStyles.motionPage}`}>
      <Link to="/instructor/courses" className={styles.backLink}>
        <ArrowLeft className={styles.backIcon} /> Return to course matrix
      </Link>

      <section className={styles.hero}>
        <div>
          <h2 className={styles.title}>
            Peer Evaluation — {selectedCourse.code} G
            {selectedGroup.section_number}
          </h2>
          <p className={styles.subtitle}>
            Initiate peer evaluation rounds, monitor submission progress, and
            close rounds to compute reputation updates for {selectedCourse.name}
            .
          </p>
        </div>
        <div className={styles.heroTags}>
          <SystemTag
            tone={
              hasActiveRound ? "success" : hasClosedRound ? "neutral" : "alert"
            }
          >
            {hasActiveRound
              ? "Round active"
              : hasClosedRound
                ? "Round closed"
                : "No active round"}
          </SystemTag>
          <SystemTag tone="neutral">
            {totalTeams} teams · {totalStudents} students
          </SystemTag>
        </div>
      </section>

      {/* Messages */}
      {actionMessage && (
        <div className={`${styles.messageBox} ${styles.messageSuccess}`}>
          {actionMessage}
        </div>
      )}
      {error && (
        <div className={`${styles.messageBox} ${styles.messageError}`}>
          {error}
        </div>
      )}

      {/* Stats */}
      <section className={styles.statsGrid}>
        <ModuleBlock
          componentId="MOD-PE1"
          eyebrow="Section"
          title="Teams"
          metric={String(totalTeams).padStart(2, "0")}
          metricLabel={`${totalStudents} students enrolled`}
          className={motionStyles.staggerItem}
          style={{ "--td-stagger-delay": "0ms" }}
        />
        <ModuleBlock
          componentId="MOD-PE2"
          eyebrow="Round"
          title="Status"
          metric={
            hasActiveRound ? "ACTIVE" : hasClosedRound ? "CLOSED" : "NONE"
          }
          metricLabel={
            hasActiveRound
              ? `Started ${new Date(activeRound.startedAt).toLocaleDateString()}`
              : hasClosedRound
                ? "Round has been completed"
                : "No peer evaluation round initiated"
          }
          accent={hasActiveRound ? "green" : "orange"}
          className={motionStyles.staggerItem}
          style={{ "--td-stagger-delay": "50ms" }}
        />
        <ModuleBlock
          componentId="MOD-PE3"
          eyebrow="Progress"
          title="Submissions"
          metric={String(activeRound?.submissionCount ?? 0).padStart(2, "0")}
          metricLabel={
            activeRound?.evaluatorCount != null
              ? `${activeRound.evaluatorCount} evaluators submitted`
              : "Awaiting submissions"
          }
          accent="orange"
          className={motionStyles.staggerItem}
          style={{ "--td-stagger-delay": "100ms" }}
        />
      </section>

      {/* Initiate Section — shown when no active round */}
      {!hasActiveRound && !hasClosedRound && (
        <ModuleBlock
          componentId="MOD-PE-INIT"
          eyebrow="Action"
          title="Initiate Peer Evaluation"
          className={`${styles.initiateSection} ${motionStyles.staggerItem}`}
          style={{ "--td-stagger-delay": "150ms" }}
        >
          <p className={styles.subtitle}>
            Create a new peer evaluation round for this section. All students
            will receive an email notification with a link to evaluate their
            teammates.
          </p>
          <div className={styles.formRow}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Round Title</span>
              <input
                type="text"
                className={styles.input}
                placeholder={`${selectedCourse.code} G${selectedGroup.section_number} Peer Eval`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Due Date</span>
              <input
                type="datetime-local"
                className={styles.input}
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </label>
            <Button
              onClick={() =>
                handleInitiate(
                  title ||
                    `${selectedCourse.code} G${selectedGroup.section_number} Peer Evaluation`,
                  dueAt ? new Date(dueAt).toISOString() : null,
                )
              }
              disabled={isInitiating || totalTeams === 0}
              variant="success"
              size="sm"
            >
              <Play className={styles.actionIcon} />{" "}
              {isInitiating ? "Initiating..." : "Start Peer Evaluation"}
            </Button>
          </div>
          {totalTeams === 0 && (
            <p className={`${styles.messageBox} ${styles.messageError}`}>
              Teams must be generated before initiating peer evaluation.
            </p>
          )}
        </ModuleBlock>
      )}

      {/* Active Round Details */}
      {hasActiveRound && (
        <ModuleBlock
          componentId="MOD-PE-ACTIVE"
          eyebrow="Active Round"
          title={activeRound.title || "Peer Evaluation Round"}
          className={`${motionStyles.staggerItem}`}
          style={{ "--td-stagger-delay": "150ms" }}
        >
          <div className={styles.roundInfo}>
            <p className={styles.roundDetail}>
              <strong>Round ID:</strong> {activeRound.id}
            </p>
            <p className={styles.roundDetail}>
              <strong>Started:</strong>{" "}
              {new Date(activeRound.startedAt).toLocaleString()}
            </p>
            {activeRound.dueAt && (
              <p className={styles.roundDetail}>
                <strong>Due:</strong>{" "}
                {new Date(activeRound.dueAt).toLocaleString()}
              </p>
            )}
            <p className={styles.roundDetail}>
              <strong>Submissions:</strong> {activeRound.submissionCount ?? 0}{" "}
              from {activeRound.evaluatorCount ?? 0} evaluators
            </p>
          </div>
          <div className={styles.actionRow}>
            <Button onClick={refreshRound} variant="outline" size="sm">
              <RefreshCw className={styles.actionIcon} /> Refresh Status
            </Button>
            <Button
              onClick={handleClose}
              disabled={isClosing}
              variant="warning"
              size="sm"
            >
              <Square className={styles.actionIcon} />{" "}
              {isClosing ? "Closing..." : "Close Round & Compute Reputation"}
            </Button>
          </div>
        </ModuleBlock>
      )}

      {/* Closed Round Results */}
      {hasClosedRound && closedResult && (
        <ModuleBlock
          componentId="MOD-PE-RESULTS"
          eyebrow="Results"
          title="Reputation Deltas"
          className={`${motionStyles.staggerItem}`}
          style={{ "--td-stagger-delay": "200ms" }}
        >
          <p className={styles.subtitle}>
            The round has been closed. Below are the reputation changes computed
            from peer evaluations. Positive deltas indicate above-average
            ratings, negative deltas indicate below-average.
          </p>
          {reputationDeltas.length > 0 ? (
            <table className={styles.deltasTable}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Avg Rating</th>
                  <th>Evaluations</th>
                  <th>Reputation Delta</th>
                </tr>
              </thead>
              <tbody>
                {reputationDeltas.map((delta) => {
                  const profile = profileLookup.get(delta.student_id);
                  const deltaClass =
                    delta.delta > 0
                      ? styles.deltaPositive
                      : delta.delta < 0
                        ? styles.deltaNegative
                        : styles.deltaNeutral;
                  return (
                    <tr key={delta.student_id}>
                      <td>
                        {profile?.name || `Student ${delta.student_id}`}
                        <br />
                        <small style={{ color: "#888" }}>
                          ID: {delta.student_id}
                        </small>
                      </td>
                      <td>{delta.avg_rating.toFixed(2)}</td>
                      <td>{delta.num_evaluations}</td>
                      <td className={deltaClass}>
                        {delta.delta > 0 ? "+" : ""}
                        {delta.delta}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className={styles.roundDetail}>
              No submissions were recorded during this round.
            </p>
          )}
        </ModuleBlock>
      )}

      {/* Closed with no result yet — allow re-initiation */}
      {hasClosedRound && !closedResult && (
        <ModuleBlock
          componentId="MOD-PE-REINIT"
          eyebrow="Round Closed"
          title="Previous round completed"
          className={`${motionStyles.staggerItem}`}
          style={{ "--td-stagger-delay": "150ms" }}
        >
          <p className={styles.subtitle}>
            The previous peer evaluation round has been closed. You can initiate
            a new round if needed.
          </p>
          <div className={styles.formRow}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Round Title</span>
              <input
                type="text"
                className={styles.input}
                placeholder={`${selectedCourse.code} G${selectedGroup.section_number} Peer Eval`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Due Date</span>
              <input
                type="datetime-local"
                className={styles.input}
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </label>
            <Button
              onClick={() =>
                handleInitiate(
                  title ||
                    `${selectedCourse.code} G${selectedGroup.section_number} Peer Evaluation`,
                  dueAt ? new Date(dueAt).toISOString() : null,
                )
              }
              disabled={isInitiating}
              variant="success"
              size="sm"
            >
              <Play className={styles.actionIcon} />{" "}
              {isInitiating ? "Initiating..." : "Start New Round"}
            </Button>
          </div>
        </ModuleBlock>
      )}
    </div>
  );
}

export default PeerEval;
