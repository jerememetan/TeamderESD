function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toNonEmptyString(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

export function normalizeAnalyticsGroup(group = {}, fallbackIndex = 0) {
  const sectionNumber = toNumber(
    group.section_number ?? group.sectionNumber,
    0,
  );
  const code = toNonEmptyString(
    group.code,
    sectionNumber ? `G${sectionNumber}` : `Group ${fallbackIndex + 1}`,
  );

  return {
    id: toNonEmptyString(group.id, `group-${fallbackIndex + 1}`),
    code,
    sectionNumber,
    studentsCount: toNumber(group.studentsCount ?? group.students_count, 0),
    teamsCount: toNumber(group.teamsCount ?? group.teams_count, 0),
  };
}

export function normalizeAnalyticsCourse(course = {}) {
  const groups = Array.isArray(course.groups)
    ? course.groups.map((group, index) => normalizeAnalyticsGroup(group, index))
    : [];

  return {
    code: toNonEmptyString(course.code, "Course"),
    name: toNonEmptyString(course.name, "Course"),
    groups,
  };
}

export function normalizeAnalyticsSection(section = {}, fallbackGroupId = "") {
  const sectionNumber = toNumber(
    section.section_number ?? section.sectionNumber,
    0,
  );
  return {
    id: toNonEmptyString(section.id, fallbackGroupId),
    code: toNonEmptyString(
      section.code,
      sectionNumber ? `G${sectionNumber}` : "Group",
    ),
    sectionNumber,
    studentsCount: toNumber(section.studentsCount ?? section.students_count, 0),
  };
}

export function normalizeAnalyticsTeams(teams = []) {
  return (Array.isArray(teams) ? teams : []).map((team, index) => {
    const teamNumber = toNumber(team.team_number ?? team.teamNumber, 0);
    const label = toNonEmptyString(
      team.name ?? team.team_name,
      teamNumber ? `Team ${teamNumber}` : `Team ${index + 1}`,
    );

    return {
      id: toNonEmptyString(team.team_id ?? team.id, `team-${index + 1}`),
      name: label,
      score: toNumber(team.formationScore ?? team.formation_score, 0),
    };
  });
}

export function buildSiblingGroupSummaryData(Name, studentCount, TeamCount) {
  return {
    name: Name,
    students: toNumber(studentCount, 0),
    teams: toNumber(TeamCount, 0),
  };
}

function teamLabel(teamAnalytics = {}, fallbackIndex = 0) {
  const numericTeamNumber = toNumber(teamAnalytics?.team_number, 0);
  return numericTeamNumber
    ? `Team ${numericTeamNumber}`
    : `Team ${fallbackIndex + 1}`;
}

function distributionBalanceScore(distribution = {}) {
  const values = Object.values(distribution || {}).map((value) =>
    toNumber(value, 0),
  );
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0 || values.length <= 1) {
    return 0;
  }

  const expected = total / values.length;
  const deviation = values.reduce(
    (sum, value) => sum + Math.abs(value - expected),
    0,
  );
  const normalized = 1 - deviation / (2 * total);
  return Math.max(0, Math.min(1, normalized)) * 100;
}

export function buildScenario2DiversityData(teamAnalytics = []) {
  const normalizedTeams = Array.isArray(teamAnalytics) ? teamAnalytics : [];
  const metrics = [
    {
      metric: "Gender Balance",
      getValue: (team) => distributionBalanceScore(team?.gender_distribution),
    },
    {
      metric: "Year Balance",
      getValue: (team) => distributionBalanceScore(team?.year_distribution),
    },
    {
      metric: "Buddy Satisfaction",
      getValue: (team) => toNumber(team?.buddy_satisfaction?.rate, 0) * 100,
    },
  ];

  return metrics.map(({ metric, getValue }) => {
    const row = { metric };

    normalizedTeams.forEach((team, index) => {
      row[teamLabel(team, index)] = Number(getValue(team).toFixed(1));
    });

    return row;
  });
}

export function buildScenario2RadarData(sectionAnalytics = {}) {
  return [
    {
      metric: "Year Balance",
      value: Number(
        (toNumber(sectionAnalytics?.year_balance_score, 0) * 100).toFixed(1),
      ),
    },
    {
      metric: "School Balance",
      value: Number(
        (toNumber(sectionAnalytics?.school_balance_score, 0) * 100).toFixed(1),
      ),
    },
    {
      metric: "Gender Balance",
      value: Number(
        (toNumber(sectionAnalytics?.gender_balance_score, 0) * 100).toFixed(1),
      ),
    },
    {
      metric: "Buddy Satisfaction",
      value: Number(
        (
          toNumber(sectionAnalytics?.buddy_satisfaction_overall?.rate, 0) * 100
        ).toFixed(1),
      ),
    },
  ];
}

export function buildScenario2TeamLegend(teamAnalytics = []) {
  return (Array.isArray(teamAnalytics) ? teamAnalytics : []).map(
    (team, index) => teamLabel(team, index),
  );
}

function average(values = []) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) {
    return 0;
  }

  const total = valid.reduce((sum, value) => sum + value, 0);
  return total / valid.length;
}

export function buildScenario2TeamQualityData(teamAnalytics = []) {
  return (Array.isArray(teamAnalytics) ? teamAnalytics : []).map(
    (team, index) => {
      const gpaMean = toNumber(team?.gpa?.mean, 0);
      const reputationMean = toNumber(team?.reputation?.mean, 0);
      const buddyRate = toNumber(team?.buddy_satisfaction?.rate, 0) * 100;

      return {
        team: teamLabel(team, index),
        "Buddy Satisfaction": Number(buddyRate.toFixed(1)),
        "GPA Mean (to 100)": Number(
          (Math.max(0, Math.min(4, gpaMean)) * 25).toFixed(1),
        ),
        "Reputation Mean": Number(
          Math.max(0, Math.min(100, reputationMean)).toFixed(1),
        ),
      };
    },
  );
}

export function buildScenario2BuddyFulfillmentData(teamAnalytics = []) {
  return (Array.isArray(teamAnalytics) ? teamAnalytics : []).map(
    (team, index) => {
      const requests = toNumber(team?.buddy_satisfaction?.requests, 0);
      const satisfied = toNumber(team?.buddy_satisfaction?.satisfied, 0);

      return {
        team: teamLabel(team, index),
        requests,
        satisfied,
        unsatisfied: Math.max(0, requests - satisfied),
      };
    },
  );
}

export function buildScenario2KpiSummary(
  sectionAnalytics = {},
  teamAnalytics = [],
) {
  const teams = Array.isArray(teamAnalytics) ? teamAnalytics : [];

  const buddyRate =
    toNumber(sectionAnalytics?.buddy_satisfaction_overall?.rate, 0) * 100;
  const buddyRequests = toNumber(
    sectionAnalytics?.buddy_satisfaction_overall?.total_requests,
    0,
  );
  const buddySatisfied = toNumber(
    sectionAnalytics?.buddy_satisfaction_overall?.total_satisfied,
    0,
  );

  const avgGpaMean = average(
    teams.map((team) => toNumber(team?.gpa?.mean, Number.NaN)),
  );
  const avgReputationMean = average(
    teams.map((team) => toNumber(team?.reputation?.mean, Number.NaN)),
  );

  return {
    buddyRate: Number(buddyRate.toFixed(1)),
    buddyRequests,
    buddySatisfied,
    avgGpaMean: Number(avgGpaMean.toFixed(2)),
    avgReputationMean: Number(avgReputationMean.toFixed(1)),
  };
}

function toDistributionRows(distribution = {}, sortByLabel = true) {
  const rows = Object.entries(distribution || {}).map(([label, count]) => ({
    label: String(label),
    count: toNumber(count, 0),
  }));

  if (sortByLabel) {
    rows.sort((a, b) => a.label.localeCompare(b.label));
  } else {
    rows.sort((a, b) => b.count - a.count);
  }

  return rows;
}

export function buildScenario2TeamDrilldown(
  teamAnalytics = [],
  selectedTeam = "",
  sectionAnalytics = {},
) {
  const teams = Array.isArray(teamAnalytics) ? teamAnalytics : [];
  if (!teams.length) {
    return null;
  }

  const index = teams.findIndex((team, teamIndex) => {
    return teamLabel(team, teamIndex) === selectedTeam;
  });

  const resolvedIndex = index >= 0 ? index : 0;
  const current = teams[resolvedIndex] || {};

  const gpaBaseline = average(
    teams.map((team) => toNumber(team?.gpa?.mean, Number.NaN)),
  );
  const reputationBaseline = average(
    teams.map((team) => toNumber(team?.reputation?.mean, Number.NaN)),
  );
  const buddyBaseline =
    toNumber(sectionAnalytics?.buddy_satisfaction_overall?.rate, 0) * 100;

  const buddyRate = toNumber(current?.buddy_satisfaction?.rate, 0) * 100;
  const buddyRequests = toNumber(current?.buddy_satisfaction?.requests, 0);
  const buddySatisfied = toNumber(current?.buddy_satisfaction?.satisfied, 0);
  const gpaMean = toNumber(current?.gpa?.mean, 0);
  const reputationMean = toNumber(current?.reputation?.mean, 0);

  return {
    team: teamLabel(current, resolvedIndex),
    buddyRate: Number(buddyRate.toFixed(1)),
    buddyRequests,
    buddySatisfied,
    buddyUnsatisfied: Math.max(0, buddyRequests - buddySatisfied),
    gpaMean: Number(gpaMean.toFixed(2)),
    reputationMean: Number(reputationMean.toFixed(1)),
    deltas: {
      buddyRate: Number((buddyRate - buddyBaseline).toFixed(1)),
      gpaMean: Number((gpaMean - gpaBaseline).toFixed(2)),
      reputationMean: Number((reputationMean - reputationBaseline).toFixed(1)),
    },
    genderDistribution: toDistributionRows(current?.gender_distribution),
    schoolDistribution: toDistributionRows(current?.school_distribution),
    mbtiDistribution: toDistributionRows(current?.mbti_distribution, false),
  };
}

export function buildPeerEvalReputationData(report = null) {
  const payload = report && typeof report === "object" ? report : {};
  const rows = Array.isArray(payload.deltas) ? payload.deltas : [];

  function effectDescription(delta) {
    const magnitude = Math.abs(Number(delta) || 0).toFixed(2);
    if (delta > 0) return `Improves reputation by ${magnitude} points`;
    if (delta < 0) return `Lowers reputation by ${magnitude} points`;
    return "No visible change in reputation";
  }

  return {
    hasPeerEval: Boolean(payload.has_peer_eval),
    message: toNonEmptyString(
      payload.message,
      "No peer evaluation data available for this section yet.",
    ),
    round:
      payload.round && typeof payload.round === "object"
        ? {
            id: toNonEmptyString(payload.round.id),
            title: toNonEmptyString(payload.round.title, "Peer Evaluation"),
          }
        : null,
    deltas: rows.map((item) => ({
      studentId: toNumber(item?.studentId, 0),
      avgRating: toNumber(item?.avgRating, 0),
      numEvaluations: toNumber(item?.numEvaluations, 0),
      delta: toNumber(item?.delta, 0),
      effectDescription: effectDescription(toNumber(item?.delta, 0)),
    })),
  };
}

export function buildWeightRecommendationsData(weightRecommendations = null) {
  const payload =
    weightRecommendations && typeof weightRecommendations === "object"
      ? weightRecommendations
      : {};
  const recommendations = Array.isArray(payload.criteria_recommendations)
    ? payload.criteria_recommendations
    : [];

  return {
    hasPeerEval: Boolean(payload.has_peer_eval),
    message: toNonEmptyString(
      payload.message,
      "No peer evaluation data available for this section yet.",
    ),
    totalEvalCount: toNumber(payload.total_eval_count, 0),
    teamsWithPeerEval: toNumber(payload.teams_with_peer_eval, 0),
    recommendationRows: recommendations.map((item) => ({
      criterion: toNonEmptyString(item?.criterion, "criterion"),
      criterionLabel: toNonEmptyString(item?.criterion_label, "Criterion"),
      association: toNonEmptyString(item?.association, "positive"),
      associationLabel:
        toNonEmptyString(item?.association, "positive") === "positive"
          ? "Positive"
          : "Negative",
      insightLabel:
        toNonEmptyString(item?.association, "positive") === "positive"
          ? "Points toward increasing this weight"
          : "Points toward reviewing this weight",
      ratingDelta: toNumber(item?.rating_delta, 0),
      currentWeight: toNumber(item?.current_weight, 0),
      qualifiedTeamCount: toNumber(item?.qualified_team_count, 0),
      highBucketAvgRating: toNumber(item?.high_bucket_avg_rating, 0),
      lowBucketAvgRating: toNumber(item?.low_bucket_avg_rating, 0),
    })),
  };
}
