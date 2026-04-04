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
import GroupChip from "../../../components/schematic/GroupChip";
import ModuleBlock from "../../../components/schematic/ModuleBlock";
import SystemTag from "../../../components/schematic/SystemTag";
import {
  buildSiblingGroupSummaryData,
} from "../../../adapters/analyticsAdapter";
import { useAnalyticsPage } from "./logic/useAnalyticsPage";
import styles from "./Analytics.module.css";

function Analytics() {
  const { courseId, groupId } = useParams();
  const {
    selectedCourse,
    selectedGroup,
    groupTeams,
    backendStudents,
    isLoadingRoster,
    rosterError,
  } = useAnalyticsPage(courseId, groupId);

  // API integration point (course-group comparison dataset):
  // Endpoint candidate: GET /section?course_id={courseId}
  // Expected object per section: { id, section_number, students_count }
  // Optional enrichment: GET /team?section_ids={id1,id2,...} -> teams count per section
  // Replace this placeholder row with a mapped array of sibling groups once endpoint shape is finalized.
  const siblingGroupSummaryData = [
    buildSiblingGroupSummaryData(
      selectedCourse?.code + " " +selectedGroup?.code,
      backendStudents.length,
      groupTeams.length,
    ),
  ];

  console.log("COURSE",selectedCourse);
  // API integration point (team diversity metrics):
  // Endpoint candidate: GET /analytics?section_id={groupId} or GET /team/{team_id}/metrics
  // Expected object per team: { team_id, team_name, skill_level_score, background_score, work_style_score }
  // Keep this static fallback until analytics-service contract is finalized.
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

  // API integration point (overall section quality radar):
  // Endpoint candidate: GET /analytics/section/{groupId}/quality
  // Expected object: {
  //   skill_balance: number,
  //   team_cohesion: number,
  //   diversity: number,
  //   communication: number,
  //   leadership: number
  // }
  // Transform backend keys into [{ metric, value }] for RadarChart.
  const radarData = [
    { metric: "Skill Balance", value: 85 },
    { metric: "Team Cohesion", value: 78 },
    { metric: "Diversity", value: 88 },
    { metric: "Communication", value: 82 },
    { metric: "Leadership", value: 90 },
  ];

  if (!selectedCourse || !selectedGroup) {
    return <div className={styles.notFound}>Course group not found</div>;
  }

  const totalStudents = backendStudents.length || selectedGroup.studentsCount;
  const averageTeamScore =
    groupTeams.reduce((sum, team) => sum + team.score, 0) /
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
          Atomic roster load failed: {rosterError}.{" "}
          <Link to="/instructor/error-logs">Go to Error Logs</Link>
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

        {/* <ModuleBlock
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
        </ModuleBlock> */}

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
      </section>
    </div>
  );
}

export default Analytics;
