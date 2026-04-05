import { Link } from "react-router";
import { AlertTriangle, ArrowUpRight, Minus, TrendingUp } from "lucide-react";
import ModuleBlock from "../../../components/schematic/ModuleBlock";
import styles from "./Analytics.module.css";

const RECOMMENDATION_BADGE = {
  INCREASE: {
    label: "Increase",
    toneClass: "recIncrease",
    icon: TrendingUp,
  },
  KEEP_OR_SLIGHTLY_REDUCE: {
    label: "Keep or Slightly Reduce",
    toneClass: "recKeep",
    icon: Minus,
  },
  FLAG_REVIEW: {
    label: "Flag for Review",
    toneClass: "recFlag",
    icon: AlertTriangle,
  },
  INSUFFICIENT_DATA: {
    label: "Insufficient Data",
    toneClass: "recNeutral",
    icon: Minus,
  },
};

function toPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "0%";
  }
  return `${Math.round(numeric * 100)}%`;
}

function renderAssociationLabel(association) {
  if (association === "strong_positive") return "Strong Positive";
  if (association === "negative") return "Negative";
  if (association === "weak_or_none") return "Weak / None";
  return "Insufficient";
}

function RecommendationCard({ item }) {
  const config =
    RECOMMENDATION_BADGE[item?.recommendation] || RECOMMENDATION_BADGE.INSUFFICIENT_DATA;
  const Icon = config.icon;

  return (
    <article className={styles.recommendationCard}>
      <div className={styles.recommendationCardTop}>
        <p className={styles.recCriterion}>{item?.criterion_label || "Criterion"}</p>
        <span className={`${styles.recBadge} ${styles[config.toneClass]}`}>
          <Icon size={14} /> {config.label}
        </span>
      </div>

      <p className={styles.recMeta}>Current Weight: {Number(item?.current_weight ?? 0).toFixed(2)}</p>
      <p className={styles.recMeta}>Association: {renderAssociationLabel(item?.association)}</p>

      <p className={styles.recReason}>{item?.reasoning || "No recommendation reasoning available."}</p>

      <div className={styles.recFooter}>
        <span>Confidence: {toPercent(item?.confidence)}</span>
        <span>
          Teams: {item?.qualified_team_count ?? 0} / min {item?.min_evals_per_team ?? 3} evals/team
        </span>
      </div>
    </article>
  );
}

export default function WeightRecommendationsSection({
  courseId,
  groupId,
  weightRecommendations,
}) {
  const hasPeerEval = Boolean(weightRecommendations?.has_peer_eval);
  const criteriaRecommendations = Array.isArray(weightRecommendations?.criteria_recommendations)
    ? weightRecommendations.criteria_recommendations
    : [];

  if (!hasPeerEval) {
    return (
      <ModuleBlock
        componentId="MOD-A10"
        eyebrow="Future Formation"
        title="Peer-Eval Weight Recommendations"
        className={`${styles.chartModule} ${styles.fullSpan}`}
      >
        <details className={styles.noPeerEvalWrap}>
          <summary className={styles.noPeerEvalSummary}>
            No peer evaluation data available for this section yet.
          </summary>
          <p className={styles.noPeerEvalBody}>
            {weightRecommendations?.message ||
              "Start and close a peer evaluation round to unlock evidence-based weight suggestions for future cohorts."}
          </p>
          <Link
            className={styles.peerEvalCta}
            to={`/instructor/courses/${encodeURIComponent(courseId)}/groups/${encodeURIComponent(groupId)}/peer-eval`}
          >
            Open Peer Evaluation <ArrowUpRight size={16} />
          </Link>
        </details>
      </ModuleBlock>
    );
  }

  return (
    <ModuleBlock
      componentId="MOD-A10"
      eyebrow="Future Formation"
      title="Peer-Eval Weight Recommendations"
      className={`${styles.chartModule} ${styles.fullSpan}`}
    >
      <div className={styles.recommendationHeader}>
        <p>
          Based on {weightRecommendations?.total_eval_count ?? 0} peer-evaluation responses from round{" "}
          {weightRecommendations?.peer_eval_round_id?.slice?.(0, 8) || "N/A"}.
        </p>
        <p>These are suggestions only.</p>
      </div>

      <div className={styles.recommendationGrid}>
        {criteriaRecommendations.map((item) => (
          <RecommendationCard key={item.criterion} item={item} />
        ))}
      </div>
    </ModuleBlock>
  );
}
