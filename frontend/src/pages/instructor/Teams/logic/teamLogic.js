export function mapBackendTeamsToViewModel(backendTeams, rosterById, courseId, groupId) {
  return backendTeams.map((team, index) => {
    const members = (team.students ?? []).map((student) => {
      const studentId = student.student_id;
      const rosterEntry = rosterById.get(studentId);

      return {
        id: String(studentId),
        name: rosterEntry?.profile?.name || `Student ${studentId}`,
        email: rosterEntry?.profile?.email || "No email available",
        studentId: `ID-${studentId}`,
        confirmationStatus: "pending",
      };
    });

    return {
      id: team.team_id,
      courseId,
      groupId,
      name: `Team ${String(team.team_number ?? index + 1).padStart(2, "0")}`,
      members,
      formationScore: 0,
      diversity: {
        skillLevel: 0,
        background: 0,
        workStyle: 0,
      },
      source: "backend",
    };
  });
}

export function swapMembersAcrossTeams(teams, firstSelection, secondSelection) {
  return teams.map((team) => {
    if (team.id === firstSelection.teamId) {
      return {
        ...team,
        members: team.members.map((member) =>
          member.id === firstSelection.member.id ? secondSelection.member : member,
        ),
      };
    }

    if (team.id === secondSelection.teamId) {
      return {
        ...team,
        members: team.members.map((member) =>
          member.id === secondSelection.member.id ? firstSelection.member : member,
        ),
      };
    }

    return team;
  });
}
