import { useEffect, useMemo, useState } from "react";
import { getBackendSectionId } from "../../../../data/backendIds";
import { fetchCourseByCode } from "../../../../services/courseService";
import { fetchEnrollmentsBySectionId } from "../../../../services/enrollmentService";
import { fetchJson } from "../../../../services/httpClient";
import {
  getPeerEvaluationRoundSubmissions,
  getPeerEvaluationRoundsForSection,
} from "../../../../services/peerEvaluationService";
import { getSectionById } from "../../../../services/sectionService";
import {
  buildSectionRoster,
  fetchAllStudents,
} from "../../../../services/studentService";
import { fetchTeamsBySection } from "../../../../services/teamService";
import {
  normalizeAnalyticsCourse,
  normalizeAnalyticsSection,
  normalizeAnalyticsTeams,
} from "../../../../adapters/analyticsAdapter";

const DASHBOARD_ANALYTICS_URL =
  import.meta.env.VITE_DASHBOARD_ANALYTICS_URL ??
  import.meta.env.VITE_DASHBOARD_URL ??
  "http://localhost:8000/dashboard";

function buildReputationDeltaReport(round, submissions) {
  if (!round || !Array.isArray(submissions) || submissions.length === 0) {
    return {
      round,
      deltas: [],
    };
  }

  const ratingsByStudent = new Map();
  for (const submission of submissions) {
    const evaluateeId = Number(submission?.evaluateeId);
    const rating = Number(submission?.rating);
    if (!Number.isInteger(evaluateeId) || !Number.isFinite(rating)) {
      continue;
    }

    if (!ratingsByStudent.has(evaluateeId)) {
      ratingsByStudent.set(evaluateeId, []);
    }
    ratingsByStudent.get(evaluateeId).push(rating);
  }

  const deltas = Array.from(ratingsByStudent.entries())
    .map(([studentId, ratings]) => {
      const avgRating =
        ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
      const delta = Math.round((avgRating - 3.0) * 10);
      return {
        studentId,
        avgRating,
        numEvaluations: ratings.length,
        delta,
      };
    })
    .sort((left, right) => {
      const absDiff = Math.abs(right.delta) - Math.abs(left.delta);
      if (absDiff !== 0) {
        return absDiff;
      }
      return right.avgRating - left.avgRating;
    });

  return {
    round,
    deltas,
  };
}

async function fetchSectionDashboardAnalytics(sectionId) {
  const payload = await fetchJson(
    `${DASHBOARD_ANALYTICS_URL}?section_id=${encodeURIComponent(sectionId)}`,
    {
      headers: { Accept: "application/json" },
      cache: false,
    },
  );

  const data = payload?.data ?? {};
  return {
    sectionAnalytics: data?.section_analytics ?? null,
    teamAnalytics: Array.isArray(data?.team_analytics)
      ? data.team_analytics
      : [],
    weightRecommendations: data?.weight_recommendations ?? null,
  };
}

export function useAnalyticsPage(courseId, groupId) {
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupTeams, setGroupTeams] = useState([]);
  const [backendStudents, setBackendStudents] = useState([]);
  const [sectionAnalytics, setSectionAnalytics] = useState(null);
  const [teamAnalytics, setTeamAnalytics] = useState([]);
  const [weightRecommendations, setWeightRecommendations] = useState(null);
  const [reputationDeltaReport, setReputationDeltaReport] = useState({
    round: null,
    deltas: [],
  });
  const [isLoadingRoster, setIsLoadingRoster] = useState(true);
  const [rosterError, setRosterError] = useState("");

  const backendSectionId = useMemo(
    () => getBackendSectionId(groupId || ""),
    [groupId],
  );
  const rosterSectionId = backendSectionId || groupId;

  useEffect(() => {
    let isMounted = true;

    async function loadAnalyticsData() {
      setIsLoadingRoster(true);
      setRosterError("");

      if (!groupId) {
        if (!isMounted) {
          return;
        }

        setSelectedCourse(null);
        setSelectedGroup(null);
        setGroupTeams([]);
        setBackendStudents([]);
        setSectionAnalytics(null);
        setTeamAnalytics([]);
        setWeightRecommendations(null);
        setRosterError("Missing group ID");
        setIsLoadingRoster(false);
        return;
      }

      const [
        courseResult,
        groupResult,
        teamsResult,
        rosterResult,
        analyticsResult,
        reputationDeltaResult,
      ] = await Promise.allSettled([
        fetchCourseByCode(courseId),
        getSectionById(groupId),
        rosterSectionId
          ? fetchTeamsBySection(rosterSectionId)
          : Promise.resolve([]),
        rosterSectionId
          ? Promise.all([
              fetchEnrollmentsBySectionId(rosterSectionId),
              fetchAllStudents(),
            ]).then(([enrollments, students]) =>
              buildSectionRoster(enrollments, students),
            )
          : Promise.resolve([]),
        rosterSectionId
          ? fetchSectionDashboardAnalytics(rosterSectionId)
          : Promise.resolve({
              sectionAnalytics: null,
              teamAnalytics: [],
              weightRecommendations: null,
            }),
        rosterSectionId
          ? getPeerEvaluationRoundsForSection(rosterSectionId, {
              status: "closed",
            }).then(async (closedRounds) => {
              const latestClosedRound = Array.isArray(closedRounds)
                ? closedRounds[0] || null
                : null;
              if (!latestClosedRound?.id) {
                return { round: null, deltas: [] };
              }

              const submissions = await getPeerEvaluationRoundSubmissions(
                latestClosedRound.id,
              );
              return buildReputationDeltaReport(latestClosedRound, submissions);
            })
          : Promise.resolve({ round: null, deltas: [] }),
      ]);

      if (!isMounted) {
        return;
      }

      setSelectedCourse(
        courseResult.status === "fulfilled"
          ? normalizeAnalyticsCourse(courseResult.value)
          : null,
      );
      setSelectedGroup(
        groupResult.status === "fulfilled"
          ? normalizeAnalyticsSection(groupResult.value, groupId)
          : null,
      );
      setGroupTeams(
        teamsResult.status === "fulfilled"
          ? normalizeAnalyticsTeams(teamsResult.value)
          : [],
      );
      setBackendStudents(
        rosterResult.status === "fulfilled" && Array.isArray(rosterResult.value)
          ? rosterResult.value
          : [],
      );
      setSectionAnalytics(
        analyticsResult.status === "fulfilled"
          ? (analyticsResult.value?.sectionAnalytics ?? null)
          : null,
      );
      setTeamAnalytics(
        analyticsResult.status === "fulfilled" &&
          Array.isArray(analyticsResult.value?.teamAnalytics)
          ? analyticsResult.value.teamAnalytics
          : [],
      );
      setWeightRecommendations(
        analyticsResult.status === "fulfilled"
          ? (analyticsResult.value?.weightRecommendations ?? null)
          : null,
      );
      setReputationDeltaReport(
        reputationDeltaResult.status === "fulfilled" &&
          reputationDeltaResult.value
          ? reputationDeltaResult.value
          : { round: null, deltas: [] },
      );

      const errors = [];
      if (courseResult.status === "rejected") {
        errors.push(courseResult.reason?.message || "Failed to load course");
      }
      if (groupResult.status === "rejected") {
        errors.push(groupResult.reason?.message || "Failed to load group");
      }
      if (teamsResult.status === "rejected") {
        errors.push(teamsResult.reason?.message || "Failed to load teams");
      }
      if (rosterResult.status === "rejected") {
        errors.push(rosterResult.reason?.message || "Failed to load roster");
      }
      if (analyticsResult.status === "rejected") {
        errors.push(
          analyticsResult.reason?.message ||
            "Failed to load scenario-2 dashboard analytics",
        );
      }
      if (reputationDeltaResult.status === "rejected") {
        errors.push(
          reputationDeltaResult.reason?.message ||
            "Failed to load peer evaluation reputation deltas",
        );
      }

      setRosterError(errors.join(" | "));
      setIsLoadingRoster(false);
    }

    loadAnalyticsData();
    return () => {
      isMounted = false;
    };
  }, [courseId, groupId, rosterSectionId]);

  return {
    selectedCourse,
    selectedGroup,
    groupTeams,
    backendStudents,
    sectionAnalytics,
    teamAnalytics,
    weightRecommendations,
    reputationDeltaReport,
    isLoadingRoster,
    rosterError,
  };
}
