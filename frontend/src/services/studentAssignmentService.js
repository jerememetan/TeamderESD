import { getBackendSectionId, getBackendStudentId } from '../data/backendIds';
import { fetchStudentProfile } from './studentProfileService';
import { fetchTeamsBySection } from './teamService';

export async function fetchStudentAssignments({ currentStudentId, courses }) {
  const backendStudentId = getBackendStudentId(currentStudentId);
  if (!backendStudentId) {
    return [];
  }

  const seenSections = new Set();
  const assignmentPromises = [];

  for (const course of courses) {
    for (const group of course.groups ?? []) {
      const sectionId = getBackendSectionId(group.id);
      if (!sectionId || seenSections.has(sectionId)) {
        continue;
      }

      seenSections.add(sectionId);
      assignmentPromises.push(
        Promise.all([
          fetchStudentProfile(sectionId),
          fetchTeamsBySection(sectionId),
        ]).then(([students, teams]) => ({
          course,
          group,
          sectionId,
          students,
          teams,
        })),
      );
    }
  }

  const sectionResults = await Promise.all(assignmentPromises);
  const assignments = [];

  for (const result of sectionResults) {
    const rosterById = new Map(result.students.map((student) => [student.student_id, student]));
    const matchingTeam = result.teams.find((team) =>
      (team.students ?? []).some((student) => student.student_id === backendStudentId),
    );

    if (!matchingTeam) {
      continue;
    }

    const members = (matchingTeam.students ?? []).map((student) => {
      const rosterEntry = rosterById.get(student.student_id);
      const isCurrentStudent = student.student_id === backendStudentId;

      return {
        id: String(student.student_id),
        name: rosterEntry?.profile?.name || `Student ${student.student_id}`,
        email: rosterEntry?.profile?.email || 'No email available',
        studentId: `ID-${student.student_id}`,
        confirmationStatus: isCurrentStudent ? 'pending' : 'confirmed',
      };
    });

    assignments.push({
      id: matchingTeam.team_id,
      courseId: result.course.id,
      groupId: result.group.id,
      name: `Team ${String(matchingTeam.team_number ?? assignments.length + 1).padStart(2, '0')}`,
      members,
      source: 'backend',
    });
  }

  return assignments;
}
