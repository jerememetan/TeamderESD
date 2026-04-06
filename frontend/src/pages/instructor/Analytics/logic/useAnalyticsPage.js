import { useEffect, useMemo, useState } from "react";
import { getBackendSectionId } from "../../../../data/backendIds";
import { fetchCourseByCode } from "../../../../services/courseService";
import { fetchEnrollmentsBySectionId } from "../../../../services/enrollmentService";
import { fetchJson } from "../../../../services/httpClient";
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
    reputationDeltaReport: data?.peer_eval_reputation ?? {
      has_peer_eval: false,
      round: null,
      deltas: [],
      message: "No peer evaluation data available for this section yet.",
    },
    weightRecommendations: data?.weight_recommendations ?? {
      has_peer_eval: false,
      criteria_recommendations: [],
      message: "No peer evaluation data available for this section yet.",
    },
  };
}

export function useAnalyticsPage(courseId, groupId) {
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupTeams, setGroupTeams] = useState([]);
  const [backendStudents, setBackendStudents] = useState([]);
  const [sectionAnalytics, setSectionAnalytics] = useState(null);
  const [teamAnalytics, setTeamAnalytics] = useState([]);
  const [reputationDeltaReport, setReputationDeltaReport] = useState({
    has_peer_eval: false,
    round: null,
    deltas: [],
    message: "No peer evaluation data available for this section yet.",
  });
  const [weightRecommendations, setWeightRecommendations] = useState({
    has_peer_eval: false,
    criteria_recommendations: [],
    message: "No peer evaluation data available for this section yet.",
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
        setReputationDeltaReport({
          has_peer_eval: false,
          round: null,
          deltas: [],
          message: "Missing group ID",
        });
        setWeightRecommendations({
          has_peer_eval: false,
          criteria_recommendations: [],
          message: "Missing group ID",
        });
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
              reputationDeltaReport: {
                has_peer_eval: false,
                round: null,
                deltas: [],
                message: "No peer evaluation data available for this section yet.",
              },
              weightRecommendations: {
                has_peer_eval: false,
                criteria_recommendations: [],
                message: "No peer evaluation data available for this section yet.",
              },
            }),
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
      setReputationDeltaReport(
        analyticsResult.status === "fulfilled" &&
          analyticsResult.value?.reputationDeltaReport
          ? analyticsResult.value.reputationDeltaReport
          : {
              has_peer_eval: false,
              round: null,
              deltas: [],
              message: "No peer evaluation data available for this section yet.",
            },
      );
      setWeightRecommendations(
        analyticsResult.status === "fulfilled" &&
          analyticsResult.value?.weightRecommendations
          ? analyticsResult.value.weightRecommendations
          : {
              has_peer_eval: false,
              criteria_recommendations: [],
              message: "No peer evaluation data available for this section yet.",
            },
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
    reputationDeltaReport,
    weightRecommendations,
    isLoadingRoster,
    rosterError,
  };
}
