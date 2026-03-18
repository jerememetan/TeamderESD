import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, CheckCircle, Clock, XCircle } from "lucide-react";
import { mockSwapRequests } from "../../data/mockData";

function SwapRequests() {
  // THESE ARE THE DATA THAT NEED TO COME FROM BACKEND LATER
  const initialRequestList = mockSwapRequests;

  const [requestList, setRequestList] = useState(initialRequestList);
  const [filter, setFilter] = useState("all");

  const filteredRequests =
    filter === "all"
      ? requestList
      : requestList.filter((request) => request.status === filter);

  const handleApprove = (requestId) => {
    setRequestList((currentRequests) =>
      currentRequests.map((request) =>
        request.id === requestId ? { ...request, status: "approved" } : request,
      ),
    );
  };

  const handleReject = (requestId) => {
    setRequestList((currentRequests) =>
      currentRequests.map((request) =>
        request.id === requestId ? { ...request, status: "rejected" } : request,
      ),
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        to="/instructor"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Team Swap Requests</h2>
        <p className="text-gray-600">Review and manage student team change requests</p>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
        <p className="font-medium text-slate-900">Backend data this page will eventually need</p>
        <p className="mt-2">
          swap request list, request status, student and course context, and
          approve/reject endpoints for instructor actions.
        </p>
      </div>

      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {["all", "pending", "approved", "rejected"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 font-medium capitalize transition-colors ${
              filter === status
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {status}
            {status !== "all" && (
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-1 text-xs">
                {requestList.filter((request) => request.status === status).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
            <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No swap requests found</p>
          </div>
        ) : (
          filteredRequests.map((request) => (
            <div
              key={request.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {request.studentName}
                    </h3>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        request.status === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : request.status === "approved"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {request.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">{request.courseName}</p>
                  <p className="text-sm text-gray-600 mb-1">
                    Current team: {request.currentTeamName}
                  </p>
                  <p className="text-sm text-gray-500">
                    Submitted on {new Date(request.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <p className="mb-2 text-sm font-medium text-gray-700">Reason:</p>
                <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                  {request.reason}
                </p>
              </div>

              {request.status === "pending" && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleApprove(request.id)}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(request.id)}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              )}

              {request.status === "approved" && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Request approved</span>
                </div>
              )}

              {request.status === "rejected" && (
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="w-5 h-5" />
                  <span className="font-medium">Request rejected</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default SwapRequests;
