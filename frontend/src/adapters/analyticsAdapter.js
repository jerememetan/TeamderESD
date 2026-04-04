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

export function buildSiblingGroupSummaryData(groups = []) {
  return (Array.isArray(groups) ? groups : []).map((group) => ({
    name: group.code,
    students: toNumber(group.studentsCount, 0),
    teams: toNumber(group.teamsCount, 0),
  }));
}

export function buildTeamScoresData(teams = []) {
  return (Array.isArray(teams) ? teams : []).map((team) => ({
    name: team.name,
    score: toNumber(team.score, 0),
  }));
}
