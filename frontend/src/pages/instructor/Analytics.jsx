import { Link, useParams } from "react-router";
import { ArrowLeft, Award, TrendingUp, Users } from "lucide-react";
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
import { mockCourses, mockTeams } from "../../data/mockData";

function Analytics() {
  const { courseId, groupId } = useParams();

  const courseList = mockCourses;
  const teamList = mockTeams;

  const selectedCourse = courseList.find((course) => course.id === courseId);
  const selectedGroup = selectedCourse?.groups.find((group) => group.id === groupId);
  const groupTeams = teamList.filter(
    (team) => team.courseId === courseId && team.groupId === groupId,
  );
  const selectedCourseGroups = selectedCourse?.groups ?? [];

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
    { metric: "Skill Level", "Team Alpha": 85, "Team Beta": 82, "Team Gamma": 93 },
    { metric: "Background", "Team Alpha": 78, "Team Beta": 89, "Team Gamma": 87 },
    { metric: "Work Style", "Team Alpha": 91, "Team Beta": 84, "Team Gamma": 95 },
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

  if (!selectedCourse || !selectedGroup) {
    return <div className="max-w-7xl mx-auto px-4 py-8">Course group not found</div>;
  }

  const totalStudents = selectedGroup.studentsCount;
  const averageTeamScore =
    groupTeams.reduce((sum, team) => sum + team.formationScore, 0) /
    (groupTeams.length || 1);
  const averageStudentsPerTeam = totalStudents / (groupTeams.length || 1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        to="/instructor/courses"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Courses
      </Link>

      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h2>
        <p className="text-gray-600">
          {selectedGroup.code} - {selectedCourse.name}
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Course-wide form settings remain shared, but analytics here are specific to{" "}
          {selectedGroup.code}. Other groups in this course:{" "}
          {selectedCourseGroups
            .filter((group) => group.id !== selectedGroup.id)
            .map((group) => group.code)
            .join(", ") || "none"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Award className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm text-gray-600">Average Team Score</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {averageTeamScore.toFixed(1)}
          </p>
          <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
            <TrendingUp className="w-4 h-4" />
            +5% from last semester
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-sm text-gray-600">Total Teams</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{groupTeams.length}</p>
          <p className="text-sm text-gray-600 mt-1">
            {averageStudentsPerTeam.toFixed(1)} students per team
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-sm text-gray-600">Response Rate</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">79%</p>
          <p className="text-sm text-gray-600 mt-1">95 of {totalStudents} students responded</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Course Group Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={siblingGroupSummaryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="students" fill="#3B82F6" />
              <Bar dataKey="teams" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Formation Scores For {selectedGroup.code}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={teamScoresData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="score" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Team Quality</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" />
              <PolarRadiusAxis domain={[0, 100]} />
              <Radar name="Score" dataKey="value" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Diversity Metrics by Team</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={diversityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="metric" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Team Alpha" fill="#3B82F6" />
              <Bar dataKey="Team Beta" fill="#10B981" />
              <Bar dataKey="Team Gamma" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Form Response Timeline</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={responseRateData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="responses" stroke="#10B981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Insights</h3>
        <div className="space-y-4">
          <div className="flex gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                OK
              </div>
            </div>
            <div>
              <p className="font-medium text-gray-900">Excellent Team Balance</p>
              <p className="text-sm text-gray-600">
                This page now evaluates one teaching group at a time instead of mixing all groups together.
              </p>
            </div>
          </div>

          <div className="flex gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                i
              </div>
            </div>
            <div>
              <p className="font-medium text-gray-900">Group-aware analytics</p>
              <p className="text-sm text-gray-600">
                You can compare {selectedGroup.code} against sibling groups while still keeping team-level charts focused on this group only.
              </p>
            </div>
          </div>

          <div className="flex gap-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-white font-bold">
                !
              </div>
            </div>
            <div>
              <p className="font-medium text-gray-900">Next backend alignment</p>
              <p className="text-sm text-gray-600">
                The backend and future APIs should expose course-group data
                explicitly, not just course totals.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Analytics;
