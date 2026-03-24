import { mockPeerEvaluationRounds, mockPeerEvaluationSubmissions } from '../data/mockData';

const peerEvaluationRounds = [...mockPeerEvaluationRounds];
const peerEvaluationSubmissions = [...mockPeerEvaluationSubmissions];

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function createPrivateReputationSignal(entries) {
  if (!entries.length) {
    return 0;
  }

  const average = entries.reduce((sum, entry) => sum + Number(entry.rating || 0), 0) / entries.length;
  return Number((average - 3).toFixed(2));
}

export function getPeerEvaluationRoundForGroup(groupId) {
  return peerEvaluationRounds.find((round) => round.groupId === groupId && round.status === 'active') || null;
}

export function getPeerEvaluationRound(roundId) {
  return peerEvaluationRounds.find((round) => round.id === roundId) || null;
}

export function startPeerEvaluationRound({ courseId, groupId, teamIds, eligibleStudentEmails }) {
  const existingRound = getPeerEvaluationRoundForGroup(groupId);
  if (existingRound) {
    return existingRound;
  }

  const round = {
    id: `peer-round-${groupId}`,
    courseId,
    groupId,
    status: 'active',
    title: `Peer Evaluation Round :: ${groupId}`,
    startedAt: new Date().toISOString(),
    dueAt: addDays(7),
    teamIds,
    eligibleStudentEmails,
  };

  peerEvaluationRounds.push(round);
  return round;
}

export function getPeerEvaluationSubmission(roundId, studentEmail) {
  return peerEvaluationSubmissions.find(
    (submission) => submission.roundId === roundId && submission.studentEmail === studentEmail,
  ) || null;
}

export function submitPeerEvaluation({ roundId, studentEmail, teamId, entries }) {
  const existing = getPeerEvaluationSubmission(roundId, studentEmail);
  if (existing) {
    return existing;
  }

  const submission = {
    id: `peer-submission-${roundId}-${studentEmail}`,
    roundId,
    studentEmail,
    teamId,
    entries,
    submittedAt: new Date().toISOString(),
    privateReputationSignal: createPrivateReputationSignal(entries),
  };

  peerEvaluationSubmissions.push(submission);
  return submission;
}

export function getPendingPeerEvaluations({ studentEmail, groupIds }) {
  return peerEvaluationRounds.filter((round) => {
    if (round.status !== 'active') {
      return false;
    }

    if (!groupIds.has(round.groupId)) {
      return false;
    }

    if (!round.eligibleStudentEmails.includes(studentEmail)) {
      return false;
    }

    return !getPeerEvaluationSubmission(round.id, studentEmail);
  });
}

export function getPeerEvaluationSummary(roundId) {
  const round = getPeerEvaluationRound(roundId);
  if (!round) {
    return null;
  }

  const submissions = peerEvaluationSubmissions.filter((submission) => submission.roundId === roundId);
  return {
    ...round,
    submissionCount: submissions.length,
    pendingCount: Math.max(round.eligibleStudentEmails.length - submissions.length, 0),
  };
}
