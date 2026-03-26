export function filterRequests(requestList, filter) {
  return filter === "all"
    ? requestList
    : requestList.filter((request) => request.status === filter);
}

export function handleApprove(requestId, setRequestList) {
  setRequestList((currentRequests) =>
    currentRequests.map((request) =>
      request.id === requestId ? { ...request, status: "approved" } : request,
    ),
  );
}

export function handleReject(requestId, setRequestList) {
  setRequestList((currentRequests) =>
    currentRequests.map((request) =>
      request.id === requestId ? { ...request, status: "rejected" } : request,
    ),
  );
}
