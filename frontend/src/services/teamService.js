import { fetchJson } from "./httpClient";

const TEAM_URL = import.meta.env.VITE_TEAM_URL ?? "http://localhost:8000/team";

export async function fetchTeamsBySection(sectionId) {
  const payload = await fetchJson(
    `${TEAM_URL}?section_id=${encodeURIComponent(sectionId)}`,
    {
      headers: { Accept: "application/json" },
    },
  );

  return payload?.data?.teams ?? [];
}

export async function fetchTeamById(teamId) {
  if (!teamId) {
    return null;
  }

  const payload = await fetchJson(`${TEAM_URL}/${encodeURIComponent(teamId)}`, {
    headers: { Accept: "application/json" },
  });

  const team = payload?.data;
  if (!team || typeof team !== "object") {
    return null;
  }

  const teamNumber = team.team_number;
  const displayName = Number.isFinite(teamNumber)
    ? `Team ${teamNumber}`
    : team.team_name || team.name || String(team.team_id || teamId);

  return {
    ...team,
    displayName,
  };
}

export async function fetchTeamsBySections(sectionIds = []) {
  const uniqueSectionIds = Array.from(new Set(sectionIds.filter(Boolean)));
  if (uniqueSectionIds.length === 0) {
    return {};
  }

  const params = new URLSearchParams();
  params.set("section_ids", uniqueSectionIds.join(","));

  const payload = await fetchJson(`${TEAM_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  const sections = payload?.data?.sections;
  if (!Array.isArray(sections)) {
    return {};
  }

  return sections.reduce((acc, sectionEntry) => {
    const sectionId = sectionEntry?.section_id;
    if (!sectionId) {
      return acc;
    }
    acc[sectionId] = Array.isArray(sectionEntry.teams)
      ? sectionEntry.teams
      : [];
    return acc;
  }, {});
}

export async function saveTeamsForSection({ sectionId, teams }) {
  if (!sectionId) {
    throw new Error("sectionId is required to save teams");
  }

  if (!Array.isArray(teams) || teams.length === 0) {
    throw new Error("At least one team is required to save teams");
  }

  const payloadTeams = teams.map((team) => {
    const teamId = String(team?.id || "").trim();
    if (!teamId) {
      throw new Error("Each team must include an id");
    }

    const members = Array.isArray(team?.members) ? team.members : [];
    const students = members.map((member) => {
      const parsedStudentId = Number(member?.id);
      if (!Number.isInteger(parsedStudentId)) {
        throw new Error("Each team member must include a valid numeric id");
      }
      return { student_id: parsedStudentId };
    });

    return {
      team_id: teamId,
      students,
    };
  });

  const payload = await fetchJson(TEAM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    cache: false,
    body: JSON.stringify({
      section_id: sectionId,
      teams: payloadTeams,
    }),
  });

  return payload?.data ?? payload;
}
