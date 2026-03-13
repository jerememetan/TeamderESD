import { Link } from "react-router";
import {
  BookOpen,
  FileText,
  Users,
  BarChart3,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { mockCourses, mockSwapRequests } from "../app/data/mockData";

function InstructorDashboard() {
    // THESE ARE THE DATA THAT NEEDS TO BE TAKEN UP, CURRENTLY TAKEN FROM MOCK DATA
  const courseList = mockCourses;
  const swapRequestList = mockSwapRequests;

  const totalCourses = courseList.length;
  const totalStudents = courseList.reduce(
    (sum, course) => sum + course.studentsCount,
    0,
  );
  const activeFormsCount = courseList.filter(
    (course) => course.formStatus === "active",
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
          Manage courses, forms, teams, and analytics
        </p>
      </div>
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <BookOpen className="w-8 h-8 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalCourses}</p>
          <p className="text-sm text-gray-600">Active Courses</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
          <p className="text-sm text-gray-600">Total Students</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <FileText className="w-8 h-8 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{activeFormsCount}</p>
          <p className="text-sm text-gray-600">Active Forms</p>
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
      {/* Quick Actions */}
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
            Manage all your courses and enrollments
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Teams</h3>
          <p className="text-sm text-gray-600 mb-4">
            Select a course to view teams
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <BarChart3 className="w-10 h-10 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Analytics
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Select a course to view analytics
          </p>
        </div>
      </div>
      {/* Recent Courses */}
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
          {recentCourses.map((course) => (
            <div
              key={course.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="font-semibold text-gray-900">{course.code}</h4>
                  <span className="text-gray-600">—</span>
                  <span className="text-gray-900">{course.name}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>{course.semester}</span>
                  <span>•</span>
                  <span>{course.studentsCount} students</span>
                  <span>•</span>
                  <span>{course.teamsCount} teams</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    course.formStatus === "active"
                      ? "bg-green-100 text-green-700"
                      : course.formStatus === "closed"
                        ? "bg-gray-100 text-gray-700"
                        : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {course.formStatus}
                </span>
                <Link
                  to={`/instructor/courses/${course.id}/teams`}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  View Details →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default InstructorDashboard;
