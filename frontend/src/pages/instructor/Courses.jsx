import { Link } from "react-router";
import { BarChart3, FileText, Plus, Users } from "lucide-react";
import { mockCourses, mockForms } from "../../data/mockData";

function Courses() {
  const courseList = mockCourses;
  const formMap = mockForms;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Courses</h2>
          <p className="text-gray-600">
            Manage courses, then work with each teaching group inside them
          </p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Course
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {courseList.map((course) => {
          const totalStudents = course.groups.reduce(
            (sum, group) => sum + group.studentsCount,
            0,
          );

          return (
            <div
              key={course.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {course.code}
                    </h3>
                    <span className="text-gray-600">-</span>
                    <span className="text-xl text-gray-900">{course.name}</span>
                  </div>
                  <p className="text-gray-600">{course.semester}</p>
                </div>
              </div>

              <div className="flex items-center gap-6 mb-6 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>{course.groups.length} groups</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>{totalStudents} students</span>
                </div>
              </div>

              <div className="mb-6 grid gap-3 md:grid-cols-2">
                {course.groups.map((group) => {
                  const existingForm = formMap[group.id];

                  return (
                    <div
                      key={group.id}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900">{group.code}</p>
                          <p className="text-sm text-gray-600">{group.label}</p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            group.formStatus === "active"
                              ? "bg-green-100 text-green-700"
                              : group.formStatus === "closed"
                                ? "bg-gray-100 text-gray-700"
                                : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          Form {group.formStatus}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{group.studentsCount} students</span>
                        <span>{group.teamsCount} teams</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <Link
                          to={`/instructor/courses/${course.id}/groups/${group.id}/create-form`}
                          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          <FileText className="w-4 h-4" />
                          {existingForm ? "Edit group form" : "Create group form"}
                        </Link>
                        <Link
                          to={`/instructor/courses/${course.id}/groups/${group.id}/analytics`}
                          className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
                        >
                          <BarChart3 className="w-4 h-4" />
                          View Group Analytics
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  to={`/instructor/courses/${course.id}/teams`}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  View All Teams
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Courses;
