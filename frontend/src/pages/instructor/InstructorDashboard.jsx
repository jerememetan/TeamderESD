import { Link } from "react-router";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  FileText,
  Users,
} from "lucide-react";
import { mockCourses, mockSwapRequests } from "../../data/mockData";

function InstructorDashboard() {
  // THESE ARE THE DATA THAT NEEDS TO BE TAKEN UP, CURRENTLY TAKEN FROM MOCK DATA
  const courseList = mockCourses;
  const swapRequestList = mockSwapRequests;
  const courseGroups = courseList.flatMap((course) => course.groups);

  const totalCourses = courseList.length;
  const totalGroups = courseGroups.length;
  const totalStudents = courseGroups.reduce(
    (sum, group) => sum + group.studentsCount,
    0,
  );
  const activeFormsCount = courseGroups.filter(
    (group) => group.formStatus === "active",
  ).length;
  const pendingSwapRequests = swapRequestList.filter(
    (request) => request.status === "pending",
  ).length;
  const recentCourses = courseList;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Instructor Dashboard
        </h2>
        <p className="text-gray-600">
          Manage courses, groups, forms, teams, and analytics
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <BookOpen className="w-8 h-8 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalCourses}</p>
          <p className="text-sm text-gray-600">Courses</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
          <p className="text-sm text-gray-600">Students Across Groups</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <FileText className="w-8 h-8 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{activeFormsCount}</p>
          <p className="text-sm text-gray-600">Active Group Forms</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="w-8 h-8 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {pendingSwapRequests}
          </p>
          <p className="text-sm text-gray-600">Pending Swaps</p>
        </div>
      </div>

      <div className="mb-8 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Business scenario update: one course can contain multiple groups like{" "}
        <span className="font-semibold">CS4320G1</span> and{" "}
        <span className="font-semibold">CS4320G2</span>. Current totals aggregate
        across <span className="font-semibold">{totalGroups}</span> groups.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Link
          to="/instructor/courses"
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow group"
        >
          <BookOpen className="w-10 h-10 text-blue-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            View Courses
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Manage course groups and enrollments
          </p>
          <div className="flex items-center text-blue-600 text-sm font-medium group-hover:gap-2 transition-all">
            Open <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </Link>

        <Link
          to="/instructor/swap-requests"
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow group relative"
        >
          {pendingSwapRequests > 0 && (
            <div className="absolute top-4 right-4 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
              {pendingSwapRequests}
            </div>
          )}
          <AlertCircle className="w-10 h-10 text-orange-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Swap Requests
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Review and approve team swap requests
          </p>
          <div className="flex items-center text-orange-600 text-sm font-medium group-hover:gap-2 transition-all">
            Review <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </Link>

        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <Users className="w-10 h-10 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Groups</h3>
          <p className="text-sm text-gray-600 mb-4">
            Select a course to inspect its teaching groups
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <BarChart3 className="w-10 h-10 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Analytics
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Compare performance across multiple groups
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            Recent Courses
          </h3>
          <Link
            to="/instructor/courses"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            View All
          </Link>
        </div>

        <div className="space-y-4">
          {recentCourses.map((course) => {
            const courseStudentCount = course.groups.reduce(
              (sum, group) => sum + group.studentsCount,
              0,
            );
            const courseState = course.groups.some(
              (group) => group.formStatus === "active",
            )
              ? "active groups"
              : course.groups.every((group) => group.formStatus === "closed")
                ? "all closed"
                : "draft groups";

            return (
              <div
                key={course.id}
                className="flex items-start justify-between gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-semibold text-gray-900">{course.code}</h4>
                    <span className="text-gray-600">-</span>
                    <span className="text-gray-900">{course.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>{course.semester}</span>
                    <span>{course.groups.length} groups</span>
                    <span>{courseStudentCount} students</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {course.groups.map((group) => (
                      <Link
                        key={group.id}
                        to={`/instructor/courses/${course.id}/groups/${group.id}/analytics`}
                        className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                      >
                        {group.code} • {group.studentsCount} students •{" "}
                        {group.teamsCount} teams
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      courseState === "active groups"
                        ? "bg-green-100 text-green-700"
                        : courseState === "all closed"
                          ? "bg-gray-100 text-gray-700"
                          : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {courseState}
                  </span>
                  <Link
                    to={`/instructor/courses`}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Manage Groups →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default InstructorDashboard;
