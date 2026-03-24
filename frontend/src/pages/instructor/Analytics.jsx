import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
import GroupChip from "../../components/schematic/GroupChip";
import ModuleBlock from "../../components/schematic/ModuleBlock";
import SystemTag from "../../components/schematic/SystemTag";
import { getBackendSectionId } from "../../data/backendIds";
import { mockCourses, mockTeams } from "../../data/mockData";
import { fetchStudentProfile } from "../../services/studentProfileService";
import styles from "./Analytics.module.css";

function Analytics() {
  const { courseId, groupId } = useParams();
  const [backendStudents, setBackendStudents] = useState([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(true);
  const [rosterError, setRosterError] = useState("");

  const selectedCourse = mockCourses.find((course) => course.id === courseId);
  const selectedGroup = selectedCourse?.groups.find(
    (group) => group.id === groupId,
  );
  const groupTeams = mockTeams.filter(
    (team) => team.courseId === courseId && team.groupId === groupId,
  );
  const selectedCourseGroups = selectedCourse?.groups ?? [];
  const backendSectionId = getBackendSectionId(groupId || "");

  useEffect(() => {
    let isMounted = true;

    async function loadRoster() {
      if (!backendSectionId) {
        setIsLoadingRoster(false);
        setRosterError("Missing backend section mapping for this group.");
        return;
      }

      setIsLoadingRoster(true);
      setRosterError("");

      try {
        const students = await fetchStudentProfile(backendSectionId);
        if (!isMounted) {
          return;
        }
        setBackendStudents(students);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setRosterError(error.message);
        setBackendStudents([]);
      } finally {
        if (isMounted) {
          setIsLoadingRoster(false);
        }
      }
    }

    loadRoster();

    return () => {
      isMounted = false;
    };
  }, [backendSectionId]);

  const siblingGroupSummaryData = selectedCourseGroups.map((group) => ({
    name: group.code,
    students: group.studentsCount,
    teams: group.teamsCount,
  }));

  const teamScoresData = groupTeams.map((team) => ({
    name: team.name,
    score: team.formationScore,
  }));

  const diversityData = [
    {
      metric: "Skill Level",
      "Team Alpha": 85,
      "Team Beta": 82,
      "Team Gamma": 93,
    },
    {
      metric: "Background",
      "Team Alpha": 78,
      "Team Beta": 89,
      "Team Gamma": 87,
    },
    {
      metric: "Work Style",
      "Team Alpha": 91,
      "Team Beta": 84,
      "Team Gamma": 95,
    },
  ];

  const radarData = [
    { metric: "Skill Balance", value: 85 },
    { metric: "Team Cohesion", value: 78 },
    { metric: "Diversity", value: 88 },
    { metric: "Communication", value: 82 },
    { metric: "Leadership", value: 90 },
  ];

  const responseRateData = [
    { week: "Week 1", responses: 45 },
    { week: "Week 2", responses: 75 },
    { week: "Week 3", responses: 95 },
  ];

  const yearDistributionData = useMemo(() => {
    const counts = backendStudents.reduce((accumulator, student) => {
      const key = student?.profile?.year
        ? `Year ${student.profile.year}`
        : "Unknown";
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {});

    return Object.entries(counts).map(([name, total]) => ({ name, total }));
  }, [backendStudents]);

  if (!selectedCourse || !selectedGroup) {
    return <div className={styles.notFound}>Course group not found</div>;
  }

  const totalStudents = backendStudents.length || selectedGroup.studentsCount;
  const averageTeamScore =
    groupTeams.reduce((sum, team) => sum + team.formationScore, 0) /
    (groupTeams.length || 1);
  const averageStudentsPerTeam = totalStudents / (groupTeams.length || 1);
  const rosterSourceTone = rosterError
    ? "alert"
    : backendStudents.length
      ? "success"
      : "neutral";

  return (
    <div className={styles.page}>
      <Link to="/instructor/courses" className={styles.backLink}>
        <ArrowLeft className={styles.backIcon} /> Return to course matrix
      </Link>

      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>[GROUP ANALYTICS CONSOLE]</p>
          <h2 className={styles.title}>
            {selectedGroup.code} performance and formation telemetry
          </h2>
          <p className={styles.subtitle}>
            {selectedCourse.name} :: compare this group against sibling clusters
            while using live roster totals from student-profile where available.
          </p>
        </div>
        <div className={styles.heroTags}>
          <GroupChip
            code={selectedGroup.code}
            meta={`${totalStudents} students � ${groupTeams.length} teams`}
            tone="green"
          />
          <SystemTag tone={rosterSourceTone}>
            {isLoadingRoster
              ? "Loading roster"
              : backendStudents.length
                ? "Live roster loaded"
                : "Roster fallback"}
          </SystemTag>
        </div>
      </section>

      {rosterError ? (
        <p className={styles.rosterError}>
          Student-profile load failed: {rosterError}
        </p>
      ) : null}

      <section className={styles.statsGrid}>
        <ModuleBlock
          componentId="MOD-A1"
          eyebrow="Score"
          title="Average Team Score"
          metric={averageTeamScore.toFixed(1)}
          metricLabel="Formation balance"
        />
        <ModuleBlock
          componentId="MOD-A2"
          eyebrow="Capacity"
          title="Total Teams"
          metric={String(groupTeams.length).padStart(2, "0")}
          metricLabel={`${averageStudentsPerTeam.toFixed(1)} students per team`}
          accent="green"
        />
        <ModuleBlock
          componentId="MOD-A3"
          eyebrow="Roster"
          title="Live Section Students"
          metric={String(totalStudents).padStart(2, "0")}
          metricLabel={
            backendStudents.length
              ? "Pulled from student-profile"
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
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={siblingGroupSummaryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#B7C5D3" />
                <XAxis
                  dataKey="name"
                  stroke="#51606F"
                  tick={{ fontSize: 12 }}
                />
                <YAxis stroke="#51606F" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="students" fill="#0047AB" />
                <Bar dataKey="teams" fill="#2ECC71" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ModuleBlock>

        <ModuleBlock
          componentId="MOD-A5"
          eyebrow="Team Index"
          title={`Formation Scores :: ${selectedGroup.code}`}
          className={styles.chartModule}
        >
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={teamScoresData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#B7C5D3" />
                <XAxis
                  dataKey="name"
                  stroke="#51606F"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#51606F"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Bar dataKey="score" fill="#0047AB" />
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
                <Bar dataKey="Team Alpha" fill="#0047AB" />
                <Bar dataKey="Team Beta" fill="#2ECC71" />
                <Bar dataKey="Team Gamma" fill="#FF6B00" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ModuleBlock>

        <ModuleBlock
          componentId="MOD-A8"
          eyebrow="Roster Mix"
          title="Year Distribution"
          className={`${styles.chartModule} ${styles.fullSpan}`}
        >
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={
                  yearDistributionData.length
                    ? yearDistributionData
                    : responseRateData
                }
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#B7C5D3" />
                <XAxis
                  dataKey={yearDistributionData.length ? "name" : "week"}
                  stroke="#51606F"
                  tick={{ fontSize: 12 }}
                />
                <YAxis stroke="#51606F" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey={yearDistributionData.length ? "total" : "responses"}
                  stroke="#2ECC71"
                  strokeWidth={2.5}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ModuleBlock>
      </section>

      <ModuleBlock
        componentId="MOD-A9"
        eyebrow="Signal Review"
        title="Operational Insights"
      >
        <div className={styles.insightList}>
          <div className={styles.insightRow}>
            <SystemTag tone="success">Stable balance</SystemTag>
            <p className={styles.insightText}>
              This console evaluates one teaching group at a time instead of
              mixing all groups together.
            </p>
          </div>
          <div className={styles.insightRow}>
            <SystemTag tone="neutral">Live roster</SystemTag>
            <p className={styles.insightText}>
              This page now uses student-profile to pull the current roster for{" "}
              {selectedGroup.code} when the backend is available.
            </p>
          </div>
          <div className={styles.insightRow}>
            <SystemTag hazard>Next integration</SystemTag>
            <p className={styles.insightText}>
              Team membership is still mock-backed. The next backend slice
              should connect team-formation and team persistence so roster and
              team assignments come from the same source.
            </p>
          </div>
        </div>
      </ModuleBlock>
    </div>
  );
}

export default Analytics;
