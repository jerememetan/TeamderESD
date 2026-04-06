import { fetchJson } from "./httpClient";

const SWAP_REQUEST_URL =
  import.meta.env.VITE_SWAP_REQUEST_URL ?? "http://localhost:8000/swap-request";
const SWAP_ORCHESTRATOR_URL =
  import.meta.env.VITE_SWAP_ORCHESTRATOR_URL ??
  "http://localhost:8000/swap-orchestrator";

export async function createSwapRequest({ studentId, currentTeamId, reason }) {
  const payload = await fetchJson(SWAP_REQUEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    cache: false,
    body: JSON.stringify({
      student_id: Number(studentId),
      current_team: currentTeamId,
      reason: String(reason || "").trim(),
    }),
  });

  return payload?.data ?? payload;
}

export async function fetchSwapReviewRequests({ sectionId, status } = {}) {
  if (!sectionId) {
    throw new Error("sectionId is required to fetch swap review requests");
  }

  const params = new URLSearchParams({ section_id: String(sectionId) });
  if (status && String(status).toLowerCase() !== "all") {
    params.set("status", String(status).toUpperCase());
  }

  const payload = await fetchJson(
    `${SWAP_ORCHESTRATOR_URL}/review/requests?${params.toString()}`,
    {
      cache: false,
    },
  );

  return payload?.data ?? payload;
}

export async function decideSwapReviewRequest({ swapRequestId, decision }) {
  if (!swapRequestId) {
    throw new Error("swapRequestId is required");
  }

  const normalizedDecision = String(decision || "").toUpperCase();
  if (!["APPROVED", "REJECTED"].includes(normalizedDecision)) {
    throw new Error("decision must be APPROVED or REJECTED");
  }

  const payload = await fetchJson(
    `${SWAP_ORCHESTRATOR_URL}/review/requests/${swapRequestId}/decision`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      cache: false,
      body: JSON.stringify({
        decision: normalizedDecision,
      }),
    },
  );

  return payload?.data ?? payload;
}

export async function confirmSectionSwaps({ sectionId }) {
  if (!sectionId) {
    throw new Error("sectionId is required");
  }

  const payload = await fetchJson(
    `${SWAP_ORCHESTRATOR_URL}/sections/${sectionId}/confirm`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      cache: false,
    },
  );

  return payload?.data ?? payload;
}
