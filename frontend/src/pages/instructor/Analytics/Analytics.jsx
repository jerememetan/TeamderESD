import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import SystemTag from "../../../components/schematic/SystemTag";
import { fetchCourseByCode } from "../../../services/courseService";
import { getSectionById } from "../../../services/sectionService";
import { fetchTeamsBySection } from "../../../services/teamService";
import { fetchSectionAnalytics } from "../../../services/analyticsService";
import styles from "./Analytics.module.css";

const TEAM_COLORS = [
  "#0047AB", "#2ECC71", "#FF6B00", "#9B59B6", "#E74C3C",
  "#1ABC9C", "#F39C12", "#3498DB", "#E91E63", "#00BCD4",
];

function Analytics() {
  const { courseId, groupId } = useParams();

  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupTeams, setGroupTeams] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch course info
  useEffect(() => {
    if (!courseId) return;
    fetchCourseByCode(courseId)
      .then(setSelectedCourse)
      .catch((err) => console.error("Course fetch failed:", err));
  }, [courseId]);

  // Fetch section info
  useEffect(() => {
    if (!groupId) return;
    getSectionById(groupId)
      .then(setSelectedGroup)
      .catch((err) => console.error("Section fetch failed:", err));
  }, [groupId]);

  // Fetch teams
  useEffect(() => {
    if (!groupId) return;
    fetchTeamsBySection(groupId)
      .then((teams) => setGroupTeams(teams || []))
      .catch((err) => {
        console.error("Teams fetch failed:", err);
        setGroupTeams([]);
      });
  }, [groupId]);

  // Fetch analytics from dashboard orchestrator
  useEffect(() => {
    if (!groupId) {
      setIsLoading(false);
      setError("Missing group ID");
      return;
    }
    setIsLoading(true);
    setError("");
    fetchSectionAnalytics(groupId)
      .then((data) => {
        setAnalyticsData(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Analytics fetch failed:", err);
        setError(err.message);
        setIsLoading(false);
      });
  }, [groupId]);

  // ── Derived chart data from real analytics ──────────────────────────

  const teamAnalytics = analyticsData?.team_analytics ?? [];
  const sectionAnalytics = analyticsData?.section_analytics ?? {};

  // GPA per team
  const gpaChartData = teamAnalytics.map((t) => ({
    name: `Team ${t.team_number}`,
    mean: t.gpa?.mean ?? 0,
    min: t.gpa?.min ?? 0,
    max: t.gpa?.max ?? 0,
  }));

  // Skill balance radar — average across all teams per skill
  const skillRadarData = useMemo(() => {
    if (!sectionAnalytics.skill_fairness) return [];
    return sectionAnalytics.skill_fairness.map((skill) => {
      const avgAcrossTeams =
        skill.team_avg_levels.reduce((a, b) => a + b, 0) /
        (skill.team_avg_levels.length || 1);
      return {
        skill: skill.skill_label,
        average: parseFloat(avgAcrossTeams.toFixed(2)),
        fairness: parseFloat(
          ((1 - (skill.std_across_teams ?? 0) / 2.5) * 5).toFixed(2)
        ),
      };
    });
  }, [sectionAnalytics]);

  // Gender distribution per team
  const genderChartData = teamAnalytics.map((t) => ({
    name: `Team ${t.team_number}`,
    Male: t.gender_distribution?.M ?? 0,
    Female: t.gender_distribution?.F ?? 0,
  }));

  // Year distribution per team
  const yearChartData = teamAnalytics.map((t) => ({
    name: `Team ${t.team_number}`,
    "Year 1": t.year_distribution?.["1"] ?? 0,
    "Year 2": t.year_distribution?.["2"] ?? 0,
    "Year 3": t.year_distribution?.["3"] ?? 0,
    "Year 4": t.year_distribution?.["4"] ?? 0,
  }));

  // School distribution per team
  const schoolChartData = teamAnalytics.map((t) => ({
    name: `Team ${t.team_number}`,
    "School 1": t.school_distribution?.["1"] ?? 0,
    "School 2": t.school_distribution?.["2"] ?? 0,
    "School 3": t.school_distribution?.["3"] ?? 0,
    "School 4": t.school_distribution?.["4"] ?? 0,
  }));

  // Reputation per team
  const reputationChartData = teamAnalytics.map((t) => ({
    name: `Team ${t.team_number}`,
    mean: t.reputation?.mean ?? 0,
    min: t.reputation?.min ?? 0,
    max: t.reputation?.max ?? 0,
  }));

  // Buddy satisfaction per team
  const buddyChartData = teamAnalytics.map((t) => ({
    name: `Team ${t.team_number}`,
    rate: t.buddy_satisfaction?.rate != null
      ? parseFloat((t.buddy_satisfaction.rate * 100).toFixed(1))
      : 0,
  }));

  // Skill balance per team — grouped bar
  const skillBalancePerTeam = useMemo(() => {
    if (!teamAnalytics.length) return [];
    const skills = teamAnalytics[0]?.skill_balance ?? [];
    return skills.map((skill) => {
      const row = { skill: skill.skill_label };
      teamAnalytics.forEach((t) => {
        const match = t.skill_balance?.find(
          (s) => s.skill_id === skill.skill_id
        );
        row[`Team ${t.team_number}`] = match?.avg_level ?? 0;
      });
      return row;
    });
  }, [teamAnalytics]);

  // ── Render ──────────────────────────────────────────────────────────

  if (!selectedCourse || !selectedGroup) {
    return <div className={styles.notFound}>Loading course data...</div>;
  }

  const totalStudents = teamAnalytics.reduce((sum, t) => sum + t.size, 0);
  const buddyOverall = sectionAnalytics.buddy_satisfaction_overall;

  return (
    <div className={styles.page}>
      <Link to="/instructor/courses" className={styles.backLink}>
        <ArrowLeft className={styles.backIcon} /> Return to course matrix
      </Link>

      <section className={styles.hero}>
        <div>
          <h2 className={styles.title}>
            Analytics — {selectedCourse.code} G
            {selectedGroup.section_number}
          </h2>
          <p className={styles.subtitle}>
            <b>Course Name</b>: {selectedCourse.name}
          </p>
        </div>
        <div className={styles.heroTags}>
          <GroupChip
            code={selectedGroup.code}
            meta={`${totalStudents} students · ${groupTeams.length} teams`}
            tone="green"
          />
          <SystemTag tone={isLoading ? "neutral" : error ? "alert" : "success"}>
            {isLoading
              ? "Loading analytics…"
              : error
                ? "Analytics unavailable"
                : "Live analytics loaded"}
          </SystemTag>
        </div>
      </section>

      {error && (
        <p className={styles.rosterError}>Analytics load failed: {error}</p>
      )}

      {/* ── Summary Cards ─────────────────────────────────────────── */}
      <section className={styles.statsGrid}>
        <ModuleBlock
          componentId="MOD-A1"
          eyebrow="Fairness"
          title="GPA Spread"
          metric={
            sectionAnalytics.gpa_fairness?.std_of_means?.toFixed(3) ?? "—"
          }
          metricLabel="Std of team GPA means (lower = fairer)"
        />
        <ModuleBlock
          componentId="MOD-A2"
          eyebrow="Teams"
          title="Total Teams"
          metric={String(sectionAnalytics.num_teams ?? 0).padStart(2, "0")}
          metricLabel={`${totalStudents} students across teams`}
          accent="green"
        />
        <ModuleBlock
          componentId="MOD-A3"
          eyebrow="Satisfaction"
          title="Buddy Match Rate"
          metric={
            buddyOverall?.rate != null
              ? `${(buddyOverall.rate * 100).toFixed(0)}%`
              : "—"
          }
          metricLabel={`${buddyOverall?.total_satisfied ?? 0}/${buddyOverall?.total_requests ?? 0} requests fulfilled`}
          accent="orange"
        />
      </section>

      {/* ── Balance Score Cards ────────────────────────────────────── */}
      <section className={styles.statsGrid}>
        <ModuleBlock
          componentId="MOD-B1"
          eyebrow="Balance"
          title="Gender Balance"
          metric={
            sectionAnalytics.gender_balance_score != null
              ? `${(sectionAnalytics.gender_balance_score * 100).toFixed(0)}%`
              : "—"
          }
          metricLabel="Cross-team gender evenness"
        />
        <ModuleBlock
          componentId="MOD-B2"
          eyebrow="Balance"
          title="Year Balance"
          metric={
            sectionAnalytics.year_balance_score != null
              ? `${(sectionAnalytics.year_balance_score * 100).toFixed(0)}%`
              : "—"
          }
          metricLabel="Cross-team year-level evenness"
          accent="green"
        />
        <ModuleBlock
          componentId="MOD-B3"
          eyebrow="Balance"
          title="School Balance"
          metric={
            sectionAnalytics.school_balance_score != null
              ? `${(sectionAnalytics.school_balance_score * 100).toFixed(0)}%`
              : "—"
          }
          metricLabel="Cross-team school mix evenness"
          accent="orange"
        />
      </section>

      {/* ── Charts ────────────────────────────────────────────────── */}
      <section className={styles.chartGrid}>
        {/* GPA by Team */}
        <ModuleBlock
          componentId="MOD-C1"
          eyebrow="GPA"
          title="Team GPA Comparison"
          className={styles.chartModule}
        >
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={gpaChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#B7C5D3" />
                <XAxis dataKey="name" stroke="#51606F" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 4]} stroke="#51606F" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="mean" fill="#0047AB" name="Mean GPA" />
                <Bar dataKey="min" fill="#E74C3C" name="Min GPA" />
                <Bar dataKey="max" fill="#2ECC71" name="Max GPA" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ModuleBlock>

        {/* Skill Balance Radar */}
        <ModuleBlock
          componentId="MOD-C2"
          eyebrow="Skills"
          title="Average Skill Levels (Section-Wide)"
          className={styles.chartModule}
        >
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={skillRadarData}>
                <PolarGrid stroke="#B7C5D3" />
                <PolarAngleAxis
                  dataKey="skill"
                  tick={{ fontSize: 10, fill: "#51606F" }}
                />
                <PolarRadiusAxis domain={[0, 5]} tick={{ fill: "#51606F" }} />
                <Radar
                  name="Avg Level"
                  dataKey="average"
                  stroke="#0047AB"
                  fill="#0047AB"
                  fillOpacity={0.25}
                />
                <Radar
                  name="Fairness (5=perfect)"
                  dataKey="fairness"
                  stroke="#FF6B00"
                  fill="#FF6B00"
                  fillOpacity={0.15}
                />
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </ModuleBlock>

        {/* Skill Balance Per Team */}
        <ModuleBlock
          componentId="MOD-C3"
          eyebrow="Skills"
          title="Skill Balance by Team"
          className={styles.chartModule}
        >
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={skillBalancePerTeam}>
                <CartesianGrid strokeDasharray="3 3" stroke="#B7C5D3" />
                <XAxis dataKey="skill" stroke="#51606F" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 5]} stroke="#51606F" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {teamAnalytics.map((t, i) => (
                  <Bar
                    key={t.team_id}
                    dataKey={`Team ${t.team_number}`}
                    fill={TEAM_COLORS[i % TEAM_COLORS.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ModuleBlock>

        {/* Gender Distribution */}
        <ModuleBlock
          componentId="MOD-C4"
          eyebrow="Demographics"
          title="Gender Distribution by Team"
          className={styles.chartModule}
        >
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={genderChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#B7C5D3" />
                <XAxis dataKey="name" stroke="#51606F" tick={{ fontSize: 12 }} />
                <YAxis stroke="#51606F" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Male" fill="#0047AB" />
                <Bar dataKey="Female" fill="#E91E63" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ModuleBlock>

        {/* Year Distribution */}
        <ModuleBlock
          componentId="MOD-C5"
          eyebrow="Demographics"
          title="Year Level Distribution by Team"
          className={styles.chartModule}
        >
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={yearChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#B7C5D3" />
                <XAxis dataKey="name" stroke="#51606F" tick={{ fontSize: 12 }} />
                <YAxis stroke="#51606F" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Year 1" fill="#0047AB" />
                <Bar dataKey="Year 2" fill="#2ECC71" />
                <Bar dataKey="Year 3" fill="#FF6B00" />
                <Bar dataKey="Year 4" fill="#9B59B6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ModuleBlock>

        {/* School Distribution */}
        <ModuleBlock
          componentId="MOD-C6"
          eyebrow="Demographics"
          title="School Distribution by Team"
          className={styles.chartModule}
        >
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={schoolChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#B7C5D3" />
                <XAxis dataKey="name" stroke="#51606F" tick={{ fontSize: 12 }} />
                <YAxis stroke="#51606F" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="School 1" fill="#0047AB" />
                <Bar dataKey="School 2" fill="#2ECC71" />
                <Bar dataKey="School 3" fill="#FF6B00" />
                <Bar dataKey="School 4" fill="#9B59B6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ModuleBlock>

        {/* Reputation by Team */}
        <ModuleBlock
          componentId="MOD-C7"
          eyebrow="Reputation"
          title="Reputation Scores by Team"
          className={styles.chartModule}
        >
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={reputationChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#B7C5D3" />
                <XAxis dataKey="name" stroke="#51606F" tick={{ fontSize: 12 }} />
                <YAxis stroke="#51606F" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="mean" fill="#0047AB" name="Mean" />
                <Bar dataKey="min" fill="#E74C3C" name="Min" />
                <Bar dataKey="max" fill="#2ECC71" name="Max" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ModuleBlock>

        {/* Buddy Satisfaction */}
        <ModuleBlock
          componentId="MOD-C8"
          eyebrow="Social"
          title="Buddy Satisfaction Rate by Team"
          className={styles.chartModule}
        >
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={buddyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#B7C5D3" />
                <XAxis dataKey="name" stroke="#51606F" tick={{ fontSize: 12 }} />
                <YAxis
                  domain={[0, 100]}
                  stroke="#51606F"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="rate" name="Satisfaction %">
                  {buddyChartData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={TEAM_COLORS[i % TEAM_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ModuleBlock>
      </section>
    </div>
  );
}

export default Analytics;
