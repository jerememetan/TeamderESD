import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import GroupChip from "../../../components/schematic/GroupChip";
import ModuleBlock from "../../../components/schematic/ModuleBlock";
import {
  buildPeerEvalReputationData,
  buildScenario2TeamDrilldown,
  buildSiblingGroupSummaryData,
  buildScenario2BuddyFulfillmentData,
  buildScenario2DiversityData,
  buildScenario2KpiSummary,
  buildScenario2RadarData,
  buildScenario2TeamLegend,
  buildScenario2TeamQualityData,
  buildWeightRecommendationsData,
} from "../../../adapters/analyticsAdapter";
import { Button } from "../../../components/ui/button";
import { useAnalyticsPage } from "./logic/useAnalyticsPage";
import styles from "./Analytics.module.css";

const QUALITY_METRICS = [
  { key: "Buddy Satisfaction", color: "#0047AB" },
  { key: "GPA Mean (to 100)", color: "#2ECC71" },
  { key: "Reputation Mean", color: "#FF6B00" },
];

function formatDelta(value, unit = "") {
  const numeric = Number(value || 0);
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${numeric.toFixed(unit === "%" ? 1 : 2)}${unit}`;
}

function deltaToneClass(value, stylesRef) {
  if (value > 0) return stylesRef.deltaPositive;
  if (value < 0) return stylesRef.deltaNegative;
  return stylesRef.deltaNeutral;
}

function Analytics() {
  const { courseId, groupId } = useParams();
  const {
    selectedCourse,
    selectedGroup,
    groupTeams,
    backendStudents,
    sectionAnalytics,
    teamAnalytics,
    reputationDeltaReport,
    weightRecommendations,
    rosterError,
  } = useAnalyticsPage(courseId, groupId);

  const siblingGroupSummaryData = [
    buildSiblingGroupSummaryData(
      selectedCourse?.code + " " + selectedGroup?.code,
      backendStudents.length,
      groupTeams.length,
    ),
  ];

  const diversityData = buildScenario2DiversityData(teamAnalytics);
  const radarData = buildScenario2RadarData(sectionAnalytics || {});
  const diversitySeries = buildScenario2TeamLegend(teamAnalytics);
  const teamQualityData = buildScenario2TeamQualityData(teamAnalytics);
  const buddyFulfillmentData =
    buildScenario2BuddyFulfillmentData(teamAnalytics);
  const kpis = buildScenario2KpiSummary(sectionAnalytics || {}, teamAnalytics);
  const [enabledMetrics, setEnabledMetrics] = useState(
    QUALITY_METRICS.map((metric) => metric.key),
  );
  const [selectedTeamLabel, setSelectedTeamLabel] = useState("");

  const resolvedSelectedTeam =
    selectedTeamLabel || teamQualityData?.[0]?.team || "";

  const selectedTeam = useMemo(() => {
    return buildScenario2TeamDrilldown(
      teamAnalytics,
      resolvedSelectedTeam,
      sectionAnalytics || {},
    );
  }, [teamAnalytics, resolvedSelectedTeam, sectionAnalytics]);

  const activeMetrics = QUALITY_METRICS.filter((metric) =>
    enabledMetrics.includes(metric.key),
  );

  function toggleMetric(metricKey) {
    setEnabledMetrics((current) => {
      if (current.includes(metricKey)) {
        const next = current.filter((item) => item !== metricKey);
        return next.length ? next : current;
      }

      return [...current, metricKey];
    });
  }

  const profileByStudentId = useMemo(
    () =>
      new Map(
        (backendStudents || []).map((row) => [
          Number(row?.student_id),
          row?.profile || {},
        ]),
      ),
    [backendStudents],
  );

  if (!selectedCourse || !selectedGroup) {
    return (
      <div className={styles.notFound}>Loading Course.... Please Wait</div>
    );
  }

  const totalStudents = backendStudents.length || selectedGroup.studentsCount;
  const averageStudentsPerTeam = totalStudents / (groupTeams.length || 1);
  const reputationData = buildPeerEvalReputationData(reputationDeltaReport);
  const recommendationData = buildWeightRecommendationsData(weightRecommendations);
  const reputationDeltaRows = reputationData.deltas;
  const reputationDeltaRound = reputationData.round;
  const hasPeerEvalData = reputationData.hasPeerEval || recommendationData.hasPeerEval;

  function recommendationToneClass(recommendation) {
    if (recommendation === "positive") return styles.recIncrease;
    if (recommendation === "negative") return styles.recFlag;
    return styles.recNeutral;
  }
  return (
    <div className={styles.page}>
      <Link to="/instructor/courses" className={styles.backLink}>
        <ArrowLeft className={styles.backIcon} /> Return to course matrix
      </Link>

      <section className={styles.hero}>
        <div>
          <h2 className={styles.title}>
            {selectedGroup.code} Analytics Page - {selectedCourse.code} G
            {selectedGroup.sectionNumber}
          </h2>
          <p className={styles.subtitle}>
            <b>Course Name</b> : {selectedCourse.name}
          </p>
        </div>
        <div className={styles.heroTags}>
          <GroupChip
            code={selectedGroup.code}
            meta={`${totalStudents} students | ${groupTeams.length} teams`}
            tone="green"
          />
        </div>
      </section>

      {rosterError ? (
        <p className={styles.rosterError}>
          Atomic roster load failed: {rosterError}.{" "}
          <Link to="/instructor/error-logs">Go to Error Logs</Link>
        </p>
      ) : null}

      <section className={styles.statsGrid}>
        <ModuleBlock
          componentId="MOD-A1"
          eyebrow="Buddy Match"
          title="Overall Satisfaction"
          metric={`${kpis.buddyRate.toFixed(1)}%`}
          metricLabel={`${kpis.buddySatisfied}/${kpis.buddyRequests} requests satisfied`}
        />
        <ModuleBlock
          componentId="MOD-A2"
          eyebrow="Academic"
          title="Average Team GPA"
          metric={kpis.avgGpaMean.toFixed(2)}
          metricLabel={`${averageStudentsPerTeam.toFixed(1)} students per team`}
          accent="green"
        />
        <ModuleBlock
          componentId="MOD-A3"
          eyebrow="Reputation"
          title="Average Team Reputation"
          metric={kpis.avgReputationMean.toFixed(1)}
          metricLabel={
            backendStudents.length
              ? "Pulled from enrollment + student-service"
              : "Using frontend fallback count"
          }
          accent="orange"
        />
      </section>

      <section className={styles.chartGrid}>
        <ModuleBlock
          componentId="MOD-A4"
          eyebrow="Comparison"
          title="Course Group Breakdown"
          className={styles.chartModule}
        >
          <div className={styles.insightList}>
            <div className={styles.insightRow}>
              <p className={styles.insightText}>
                <b>Group:</b> {siblingGroupSummaryData[0]?.name || "N/A"}
              </p>
            </div>
            <div className={styles.insightRow}>
              <p className={styles.insightText}>
                <b>Students:</b> {siblingGroupSummaryData[0]?.students ?? 0}
              </p>
            </div>
            <div className={styles.insightRow}>
              <p className={styles.insightText}>
                <b>Teams:</b> {siblingGroupSummaryData[0]?.teams ?? 0}
              </p>
            </div>
          </div>
        </ModuleBlock>

        <ModuleBlock
          componentId="MOD-A5"
          eyebrow="Team Quality"
          title={`Team Composite Quality :: ${selectedGroup.code}`}
          className={styles.chartModule}
        >
          <div className={styles.metricToggleRow}>
            {QUALITY_METRICS.map((metric) => {
              const active = enabledMetrics.includes(metric.key);
              return (
                <Button
                  key={metric.key}
                  variant={active ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleMetric(metric.key)}
                  className={active ? styles.metricToggleActive : ""}
                >
                  {metric.key}
                </Button>
              );
            })}
          </div>
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={teamQualityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#B7C5D3" />
                <XAxis
                  dataKey="team"
                  stroke="#51606F"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#51606F"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Legend />
                {activeMetrics.map((metric) => (
                  <Bar
                    key={metric.key}
                    dataKey={metric.key}
                    fill={metric.color}
                    onClick={(entry) => {
                      if (entry?.team) {
                        setSelectedTeamLabel(entry.team);
                      }
                    }}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ModuleBlock>

        <ModuleBlock
          componentId="MOD-A6"
          eyebrow="Balance Radar"
          title="Overall Team Quality"
          className={styles.chartModule}
        >
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#B7C5D3" />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fontSize: 11, fill: "#51606F" }}
                />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#51606F" }} />
                <Radar
                  name="Score"
                  dataKey="value"
                  stroke="#FF6B00"
                  fill="#FF6B00"
                  fillOpacity={0.28}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </ModuleBlock>

        <ModuleBlock
          componentId="MOD-A7"
          eyebrow="Diversity"
          title="Metrics by Team"
          className={styles.chartModule}
        >
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={diversityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#B7C5D3" />
                <XAxis
                  dataKey="metric"
                  stroke="#51606F"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#51606F"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Legend />
                {diversitySeries.length ? (
                  diversitySeries.map((seriesName, index) => {
                    const palette = [
                      "#0047AB",
                      "#2ECC71",
                      "#FF6B00",
                      "#1F7A8C",
                      "#D7263D",
                    ];
                    return (
                      <Bar
                        key={seriesName}
                        dataKey={seriesName}
                        fill={palette[index % palette.length]}
                      />
                    );
                  })
                ) : (
                  <Bar dataKey="No Team Data" fill="#9AA5B1" />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ModuleBlock>

        <ModuleBlock
          componentId="MOD-A9"
          eyebrow="Team Drilldown"
          title={`Selected Team Detail :: ${selectedTeam?.team || "N/A"}`}
          className={`${styles.chartModule} ${styles.fullSpan}`}
        >
          {selectedTeam ? (
            <div className={styles.drilldownWrap}>
              <div className={styles.kpiRow}>
                <div className={styles.kpiCard}>
                  <p className={styles.kpiLabel}>Buddy Satisfaction</p>
                  <p className={styles.kpiValue}>
                    {selectedTeam.buddyRate.toFixed(1)}%
                  </p>
                  <p
                    className={`${styles.kpiDelta} ${deltaToneClass(selectedTeam.deltas.buddyRate, styles)}`}
                  >
                    {formatDelta(selectedTeam.deltas.buddyRate, "%")} vs section
                  </p>
                </div>
                <div className={styles.kpiCard}>
                  <p className={styles.kpiLabel}>GPA Mean</p>
                  <p className={styles.kpiValue}>
                    {selectedTeam.gpaMean.toFixed(2)}
                  </p>
                  <p
                    className={`${styles.kpiDelta} ${deltaToneClass(selectedTeam.deltas.gpaMean, styles)}`}
                  >
                    {formatDelta(selectedTeam.deltas.gpaMean)} vs section
                  </p>
                </div>
                <div className={styles.kpiCard}>
                  <p className={styles.kpiLabel}>Reputation Mean</p>
                  <p className={styles.kpiValue}>
                    {selectedTeam.reputationMean.toFixed(1)}
                  </p>
                  <p
                    className={`${styles.kpiDelta} ${deltaToneClass(selectedTeam.deltas.reputationMean, styles)}`}
                  >
                    {formatDelta(selectedTeam.deltas.reputationMean)} vs section
                  </p>
                </div>
              </div>

              <div className={styles.distributionGrid}>
                <div className={styles.distributionCard}>
                  <p className={styles.distTitle}>Gender Distribution</p>
                  {selectedTeam.genderDistribution.map((item) => (
                    <p key={`gender-${item.label}`} className={styles.distItem}>
                      {item.label}: {item.count}
                    </p>
                  ))}
                </div>
                <div className={styles.distributionCard}>
                  <p className={styles.distTitle}>School Distribution</p>
                  {selectedTeam.schoolDistribution.map((item) => (
                    <p key={`school-${item.label}`} className={styles.distItem}>
                      School {item.label}: {item.count}
                    </p>
                  ))}
                </div>
                <div className={styles.distributionCard}>
                  <p className={styles.distTitle}>Top MBTI Types</p>
                  {selectedTeam.mbtiDistribution.slice(0, 6).map((item) => (
                    <p key={`mbti-${item.label}`} className={styles.distItem}>
                      {item.label}: {item.count}
                    </p>
                  ))}
                </div>
              </div>

              <p className={styles.buddyFootnote}>
                Buddy requests: {selectedTeam.buddyRequests} total,{" "}
                {selectedTeam.buddySatisfied} satisfied,{" "}
                {selectedTeam.buddyUnsatisfied} unsatisfied.
              </p>
            </div>
          ) : (
            <p className={styles.subtitle}>
              No team analytics found for drill-down.
            </p>
          )}
        </ModuleBlock>
        <ModuleBlock
          componentId="MOD-A8"
          eyebrow="Buddy Requests"
          title="Request Fulfillment by Team"
          className={`${styles.chartModule} ${styles.fullSpan}`}
        >
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={buddyFulfillmentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#B7C5D3" />
                <XAxis
                  dataKey="team"
                  stroke="#51606F"
                  tick={{ fontSize: 12 }}
                />
                <YAxis stroke="#51606F" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="requests" fill="#1F7A8C" />
                <Bar dataKey="satisfied" fill="#2ECC71" />
                <Bar dataKey="unsatisfied" fill="#D7263D" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ModuleBlock>

        {hasPeerEvalData ? (
          <>
            <ModuleBlock
              componentId="MOD-A10"
              eyebrow="Peer Evaluation"
              title="Reputation Delta Summary"
              className={`${styles.chartModule} ${styles.fullSpan}`}
            >
              {reputationDeltaRound ? (
                <p className={styles.summaryNote}>
                  Latest closed round:{" "}
                  {reputationDeltaRound.title || "Peer Evaluation"} ({
                    String(reputationDeltaRound.id || "").slice(0, 8)
                  })
                </p>
              ) : (
                <p className={styles.summaryNote}>{reputationData.message}</p>
              )}

              {reputationDeltaRows.length > 0 ? (
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
                    {reputationDeltaRows.map((delta) => {
                      const profile = profileByStudentId.get(delta.studentId);
                      const deltaClass =
                        delta.delta > 0
                          ? styles.deltaPositive
                          : delta.delta < 0
                            ? styles.deltaNegative
                            : styles.deltaNeutral;
                      return (
                        <tr key={`delta-${delta.studentId}`}>
                          <td>
                            {profile?.name || `Student ${delta.studentId}`}
                            <br />
                            <small className={styles.summarySubtle}>
                              ID: {delta.studentId}
                            </small>
                          </td>
                          <td>{Number(delta.avgRating || 0).toFixed(2)}</td>
                          <td>{delta.numEvaluations}</td>
                          <td className={deltaClass}>{formatDelta(delta.delta)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className={styles.summaryNote}>{reputationData.message}</p>
              )}
            </ModuleBlock>

            <ModuleBlock
              componentId="MOD-A11"
              eyebrow="Formation Insights"
              title="Peer Evaluation Insights"
              className={`${styles.chartModule} ${styles.fullSpan}`}
            >
              {recommendationData.hasPeerEval ? (
                <>
                  <div className={styles.recommendationHeader}>
                    <p>
                      Based on {recommendationData.totalEvalCount} peer evaluations
                      across {recommendationData.teamsWithPeerEval} teams.
                    </p>
                  </div>
                  {recommendationData.recommendationRows.length ? (
                    <div className={styles.recommendationGrid}>
                      {recommendationData.recommendationRows.map((item) => (
                        <article
                          key={`recommendation-${item.criterion}`}
                          className={styles.recommendationCard}
                        >
                          <div className={styles.recommendationCardTop}>
                            <p className={styles.recCriterion}>{item.criterionLabel}</p>
                            <span
                              className={`${styles.recBadge} ${recommendationToneClass(item.recommendation)}`}
                            >
                              {item.associationLabel}
                            </span>
                          </div>
                          <p className={styles.recMeta}>
                            {item.insightLabel} | Rating difference: {formatDelta(item.ratingDelta)}
                          </p>
                          <p className={styles.recFooter}>
                            <span>Current Weight: {item.currentWeight.toFixed(2)}</span>
                            <span>Qualified Teams: {item.qualifiedTeamCount}</span>
                          </p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.summaryNote}>{recommendationData.message}</p>
                  )}
                </>
              ) : (
                <p className={styles.summaryNote}>{recommendationData.message}</p>
              )}
            </ModuleBlock>
          </>
        ) : (
          <ModuleBlock
            componentId="MOD-A10"
            eyebrow="Peer Evaluation"
            title="Peer Evaluation Data"
            className={`${styles.chartModule} ${styles.fullSpan}`}
          >
            <p className={styles.summaryNote}>
              No peer eval data available yet.
            </p>
          </ModuleBlock>
        )}
      </section>
    </div>
  );
}

export default Analytics;
