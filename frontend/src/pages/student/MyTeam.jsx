import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Mail, RefreshCw, Users as UsersIcon } from "lucide-react";
import {
  currentStudent,
  currentStudentTeam,
  mockCourses,
  mockStudentStrengths,
  mockTeams,
} from "../../data/mockData";

function MyTeam() {
  // THESE ARE THE DATA THAT NEED TO COME FROM BACKEND LATER
  const studentProfile = currentStudent;
  const activeTeam = currentStudentTeam;
  const teamList = mockTeams;
  const strengthMap = mockStudentStrengths;
  const courseList = mockCourses;

  const [showSwapModal, setShowSwapModal] = useState(false);
  const [selectedTargetTeam, setSelectedTargetTeam] = useState("");
  const [swapReason, setSwapReason] = useState("");

  const selectedCourse = courseList.find((course) => course.id === activeTeam.courseId);
  const selectedGroup = selectedCourse?.groups.find((group) => group.id === activeTeam.groupId);
  const otherTeams = teamList.filter((team) => team.id !== activeTeam.id);

  const getStrongestCriteria = (studentId) =>
    strengthMap[studentId] || ["Teamwork", "General contribution"];

  const handleSubmitSwapRequest = (event) => {
    event.preventDefault();
    console.log("Swap request:", {
      currentTeamId: activeTeam.id,
      targetTeamId: selectedTargetTeam,
      reason: swapReason,
    });
    alert("Swap request submitted successfully!");
    setShowSwapModal(false);
    setSelectedTargetTeam("");
    setSwapReason("");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        to="/student"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">My Team</h2>
        <p className="text-gray-600">
          View your teammates and the strengths each member brings to the team.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{activeTeam.name}</h3>
            <p className="text-gray-600">
              {selectedCourse?.name} ({selectedCourse?.code}){selectedGroup ? ` - ${selectedGroup.code}` : ""}
            </p>
          </div>
          <button
            onClick={() => setShowSwapModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Request Team Swap
          </button>
        </div>

        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Backend data this page will eventually need</p>
          <p className="mt-2">
            current team details, member list, each student's strongest criteria,
            course and group context, available swap targets, and the swap-request API.
          </p>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-600">Group</p>
            <p className="mt-1 font-semibold text-gray-900">
              {selectedGroup?.code || "Not assigned"}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-600">Team Members</p>
            <p className="mt-1 font-semibold text-gray-900">
              {activeTeam.members.length} students
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-600">Course</p>
            <p className="mt-1 font-semibold text-gray-900">
              {selectedCourse?.code || "Unknown course"}
            </p>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-gray-900 mb-4">
            Team Members ({activeTeam.members.length})
          </h4>
          <div className="space-y-4">
            {activeTeam.members.map((member) => {
              const strongestCriteria = getStrongestCriteria(member.id);

              return (
                <div
                  key={member.id}
                  className={`rounded-lg border p-4 ${
                    member.id === studentProfile.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:bg-gray-50"
                  } transition-colors`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold">{member.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {member.name}
                          {member.id === studentProfile.id && (
                            <span className="ml-2 text-xs px-2 py-1 bg-blue-600 text-white rounded-full">
                              You
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-600">{member.studentId}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {strongestCriteria.map((criterion) => (
                            <span
                              key={criterion}
                              className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 border border-gray-200"
                            >
                              Strongest: {criterion}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-4 h-4" />
                      <span className="text-sm">{member.email}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showSwapModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Request Team Swap</h3>
              <p className="text-sm text-gray-600 mt-1">
                Submit a request to move from {activeTeam.name} to another team in the same course.
              </p>
            </div>

            <form onSubmit={handleSubmitSwapRequest} className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Target Team
                </label>
                <div className="space-y-2">
                  {otherTeams.map((team) => (
                    <label
                      key={team.id}
                      className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedTargetTeam === team.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="targetTeam"
                          value={team.id}
                          checked={selectedTargetTeam === team.id}
                          onChange={(event) => setSelectedTargetTeam(event.target.value)}
                          className="w-4 h-4 text-blue-600"
                          required
                        />
                        <div>
                          <p className="font-medium text-gray-900">{team.name}</p>
                          <p className="text-sm text-gray-600">
                            {team.members.length} members
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-gray-500">
                        <UsersIcon className="w-4 h-4" />
                        <span className="text-sm">{team.groupId}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Swap Request
                </label>
                <textarea
                  value={swapReason}
                  onChange={(event) => setSwapReason(event.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Explain why you would like to swap teams..."
                  required
                />
                <p className="text-sm text-gray-500 mt-2">
                  Your instructor will review this request. Please provide a clear and respectful
                  explanation.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Submit Request
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSwapModal(false);
                    setSelectedTargetTeam("");
                    setSwapReason("");
                  }}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyTeam;
