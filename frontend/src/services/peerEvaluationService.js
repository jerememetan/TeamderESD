import { fetchJson } from "./httpClient";

const PEER_EVAL_URL =
  import.meta.env.VITE_PEER_EVAL_URL ?? "http://localhost:8000/peer-eval";

const PEER_EVAL_NOTIFICATION_URL =
  import.meta.env.VITE_PEER_EVAL_NOTIFICATION_URL ??
  "http://localhost:8000/peer-eval-notifications";

/**
 * Get a peer evaluation round by ID.
 */
export async function getPeerEvaluationRound(roundId) {
  try {
    const payload = await fetchJson(`${PEER_EVAL_URL}/rounds/${roundId}`, {
      headers: { Accept: "application/json" },
    });
    const round = payload?.data;
    if (!round) return null;
    // Normalize to match the shape the frontend expects
    return {
      id: round.round_id,
      sectionId: round.section_id,
      status: round.status,
      title: round.title,
      dueAt: round.due_at,
      startedAt: round.created_at,
      submissionCount: round.submission_count ?? 0,
      evaluatorCount: round.evaluator_count ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Get the active peer evaluation round for a section.
 */
export async function getPeerEvaluationRoundForSection(sectionId) {
  try {
    const payload = await fetchJson(
      `${PEER_EVAL_URL}/rounds?section_id=${encodeURIComponent(sectionId)}&status=active`,
      { headers: { Accept: "application/json" } },
    );
    const rounds = payload?.data ?? [];
    if (!rounds.length) return null;
    const round = rounds[0];
    return {
      id: round.round_id,
      sectionId: round.section_id,
      status: round.status,
      title: round.title,
      dueAt: round.due_at,
      startedAt: round.created_at,
    };
  } catch {
    return null;
  }
}

export async function getPeerEvaluationRoundsForSection(
  sectionId,
  { status } = {},
) {
  if (!sectionId) {
    return [];
  }

  const params = new URLSearchParams({
    section_id: String(sectionId),
  });
  if (status) {
    params.set("status", String(status).toLowerCase());
  }

  const payload = await fetchJson(
    `${PEER_EVAL_URL}/rounds?${params.toString()}`,
    {
      headers: { Accept: "application/json" },
      cache: false,
    },
  );

  const rounds = Array.isArray(payload?.data) ? payload.data : [];
  return rounds.map((round) => ({
    id: round.round_id,
    sectionId: round.section_id,
    status: round.status,
    title: round.title,
    dueAt: round.due_at,
    startedAt: round.created_at,
  }));
}

export async function getPeerEvaluationRoundSubmissions(roundId) {
  if (!roundId) {
    return [];
  }

  const payload = await fetchJson(
    `${PEER_EVAL_URL}/rounds/${roundId}/submissions`,
    {
      headers: { Accept: "application/json" },
      cache: false,
    },
  );

  const submissions = Array.isArray(payload?.data) ? payload.data : [];
  return submissions.map((row) => ({
    submissionId: row.submission_id,
    roundId: row.round_id,
    evaluatorId: Number(row.evaluator_id),
    evaluateeId: Number(row.evaluatee_id),
    rating: Number(row.rating),
    justification: row.justification || "",
    submittedAt: row.submitted_at,
    teamId: row.team_id,
  }));
}

/**
 * Check if a student has already submitted for a round.
 * Returns the submission data if found, null otherwise.
 */
export async function getPeerEvaluationSubmission(roundId, evaluatorId) {
  try {
    const numericId =
      typeof evaluatorId === "string" ? parseInt(evaluatorId, 10) : evaluatorId;
    const payload = await fetchJson(
      `${PEER_EVAL_URL}/rounds/${roundId}/submissions?evaluator_id=${numericId}`,
      { headers: { Accept: "application/json" }, cache: false },
    );
    const submissions = payload?.data ?? [];
    if (!submissions.length) return null;
    return {
      id: `submission-${roundId}-${numericId}`,
      roundId,
      evaluatorId: numericId,
      entries: submissions,
      submittedAt: submissions[0]?.submitted_at,
    };
  } catch {
    return null;
  }
}

/**
 * Submit peer evaluations for all teammates.
 */
export async function submitPeerEvaluation({
  roundId,
  evaluatorId,
  teamId,
  entries,
}) {
  const numericEvaluatorId =
    typeof evaluatorId === "string" ? parseInt(evaluatorId, 10) : evaluatorId;

  const payload = await fetchJson(`${PEER_EVAL_URL}/rounds/${roundId}/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      evaluator_id: numericEvaluatorId,
      team_id: teamId,
      entries: entries.map((entry) => ({
        evaluatee_id:
          typeof entry.evaluateeId === "string"
            ? parseInt(entry.evaluateeId, 10)
            : entry.evaluateeId,
        rating: Number(entry.rating),
        justification: entry.justification || "",
      })),
    }),
    cache: false,
  });

  return payload?.data;
}

/**
 * Get pending peer evaluations for a student across their sections.
 * Returns array of active rounds where the student hasn't submitted yet.
 */
export async function getPendingPeerEvaluations({ studentId, sectionIds }) {
  const numericId =
    typeof studentId === "string" ? parseInt(studentId, 10) : studentId;
  const pending = [];

  for (const sectionId of sectionIds) {
    try {
      const round = await getPeerEvaluationRoundForSection(sectionId);
      if (!round || round.status !== "active") continue;

      const existing = await getPeerEvaluationSubmission(round.id, numericId);
      if (!existing) {
        pending.push(round);
      }
    } catch {
      // Skip sections that fail
    }
  }

  return pending;
}

/**
 * Get active peer evaluation rounds grouped by section for dashboard metrics.
 */
export async function getActivePeerEvaluationRoundsBySections(sectionIds = []) {
  const uniqueSectionIds = Array.from(new Set(sectionIds.filter(Boolean)));
  if (!uniqueSectionIds.length) {
    return {};
  }

  const results = await Promise.allSettled(
    uniqueSectionIds.map(async (sectionId) => {
      const payload = await fetchJson(
        `${PEER_EVAL_URL}/rounds?section_id=${encodeURIComponent(sectionId)}&status=active`,
        { headers: { Accept: "application/json" } },
      );

      const rounds = Array.isArray(payload?.data) ? payload.data : [];
      return {
        sectionId,
        rounds: rounds.map((round) => ({
          id: round.round_id,
          sectionId: round.section_id,
          status: round.status,
          title: round.title,
          dueAt: round.due_at,
          startedAt: round.created_at,
        })),
      };
    }),
  );

  return results.reduce((acc, result) => {
    if (result.status !== "fulfilled") {
      return acc;
    }

    acc[result.value.sectionId] = result.value.rounds;
    return acc;
  }, {});
}

/**
 * Instructor initiates a peer evaluation round via peer-eval-notification.
 */
export async function startPeerEvaluationRound({ sectionId, title, dueAt }) {
  const payload = await fetchJson(`${PEER_EVAL_NOTIFICATION_URL}/initiate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      section_id: sectionId,
      title: title || `Peer Evaluation — Section ${sectionId.slice(0, 8)}`,
      due_at: dueAt || null,
    }),
    cache: false,
  });

  return payload?.data;
}

/**
 * Instructor closes a peer evaluation round via peer-eval-notification.
 */
export async function closePeerEvaluationRound(roundId) {
  const payload = await fetchJson(`${PEER_EVAL_NOTIFICATION_URL}/close`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ round_id: roundId }),
    cache: false,
  });

  return payload?.data;
}

/**
 * Get summary for a peer evaluation round.
 */
export async function getPeerEvaluationSummary(roundId) {
  const round = await getPeerEvaluationRound(roundId);
  if (!round) return null;
  return {
    ...round,
    submissionCount: round.submissionCount ?? 0,
    pendingCount: 0, // Would need to know total eligible students to compute this
  };
}

export async function getPeerEvaluationRoundForGroup(groupId) {
  try {
    return await getPeerEvaluationRoundForSection(groupId);
  } catch {
    return null;
  }
}
