import { fetchJson } from "./httpClient";

const SWAP_REQUEST_URL =
  import.meta.env.VITE_SWAP_REQUEST_URL ?? "http://localhost:8000/swap-request";

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
