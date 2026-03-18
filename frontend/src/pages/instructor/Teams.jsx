import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, CheckCircle, Mail, Users, XCircle } from "lucide-react";
import { mockCourses, mockSwapRequests, mockTeams } from "../../data/mockData";

function Teams() {
  const { courseId } = useParams();

  // THESE ARE THE DATA THAT NEED TO COME FROM BACKEND LATER
  const courseList = mockCourses;
  const teamList = mockTeams;
  const initialSwapRequestList = mockSwapRequests;

  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [swapRequestList, setSwapRequestList] = useState(initialSwapRequestList);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const selectedCourse = courseList.find((course) => course.id === courseId);
  const courseTeams = teamList.filter((team) => team.courseId === courseId);
  const selectedTeam =
    courseTeams.find((team) => team.id === selectedTeamId) || courseTeams[0] || null;

  const pendingRequestMap = useMemo(
    () =>
      Object.fromEntries(
        swapRequestList
          .filter((request) => request.status === "pending")
          .map((request) => [request.studentId, request]),
      ),
    [swapRequestList],
  );

  if (!selectedCourse) {
    return <div className="max-w-7xl mx-auto px-4 py-8">Course not found</div>;
  }

  const handleApprove = (requestId) => {
    setSwapRequestList((currentRequests) =>
      currentRequests.map((request) =>
        request.id === requestId ? { ...request, status: "approved" } : request,
      ),
    );
    setSelectedRequest((currentRequest) =>
      currentRequest?.id === requestId
        ? { ...currentRequest, status: "approved" }
        : currentRequest,
    );
  };

  const handleReject = (requestId) => {
    setSwapRequestList((currentRequests) =>
      currentRequests.map((request) =>
        request.id === requestId ? { ...request, status: "rejected" } : request,
      ),
    );
    setSelectedRequest((currentRequest) =>
      currentRequest?.id === requestId
        ? { ...currentRequest, status: "rejected" }
        : currentRequest,
    );
  };

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
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Teams</h2>
        <p className="text-gray-600">
          {selectedCourse.code} - {selectedCourse.name}
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
        <p className="font-medium text-slate-900">Backend data this page will eventually need</p>
        <p className="mt-2">
          course teams, team members, pending swap requests by student, and approve/reject
          APIs so instructors can review requests directly from the team view.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">All Teams ({courseTeams.length})</h3>
            <div className="space-y-2">
              {courseTeams.map((team) => {
                const hasPendingRequest = team.members.some(
                  (member) => pendingRequestMap[member.id],
                );

                return (
                  <button
                    key={team.id}
                    onClick={() => setSelectedTeamId(team.id)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      selectedTeam?.id === team.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900">{team.name}</span>
                      {hasPendingRequest && (
                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                          Pending swap
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-4 h-4" />
                      <span>{team.members.length} members</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedTeam ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{selectedTeam.name}</h3>
                  <p className="text-sm text-gray-600">{selectedTeam.groupId}</p>
                </div>
                <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-2">
                  <p className="text-sm text-gray-600">Members</p>
                  <p className="font-semibold text-gray-900">{selectedTeam.members.length}</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-3">
                  Team Members ({selectedTeam.members.length})
                </h4>
                <div className="space-y-3">
                  {selectedTeam.members.map((member) => {
                    const pendingRequest = pendingRequestMap[member.id];

                    return (
                      <div
                        key={member.id}
                        className={`rounded-lg border p-4 transition-colors ${
                          pendingRequest
                            ? "border-red-300 bg-red-50"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 font-semibold">
                                {member.name.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{member.name}</p>
                              <p className="text-sm text-gray-600">{member.studentId}</p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 md:items-end">
                            <div className="flex items-center gap-2 text-gray-600">
                              <Mail className="w-4 h-4" />
                              <span className="text-sm">{member.email}</span>
                            </div>
                            {pendingRequest && (
                              <button
                                onClick={() => setSelectedRequest(pendingRequest)}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                              >
                                See swap request
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Select a team to view details</p>
            </div>
          )}
        </div>
      </div>

      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
            <div className="border-b border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900">Swap Request</h3>
              <p className="mt-1 text-sm text-gray-600">
                {selectedRequest.studentName} from {selectedRequest.currentTeamName}
              </p>
            </div>

            <div className="p-6">
              <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="mb-2 text-sm font-medium text-gray-700">Reason</p>
                <p className="text-sm text-gray-700">{selectedRequest.reason}</p>
              </div>

              <div className="flex gap-3">
                {selectedRequest.status === "pending" ? (
                  <>
                    <button
                      onClick={() => handleApprove(selectedRequest.id)}
                      className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(selectedRequest.id)}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </>
                ) : (
                  <div
                    className={`rounded-lg px-4 py-2 text-sm font-medium ${
                      selectedRequest.status === "approved"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    Request {selectedRequest.status}
                  </div>
                )}
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Teams;
