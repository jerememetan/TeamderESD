import { useEffect, useMemo, useState } from "react";
import { mockStudents, mockTeams } from "../data/mockData";

const ACTIVE_STUDENT_KEY = "teamder.activeStudentId";
const DEFAULT_STUDENT_ID = "s12";

function getStoredStudentId() {
  if (typeof window === "undefined") {
    return DEFAULT_STUDENT_ID;
  }

  return window.localStorage.getItem(ACTIVE_STUDENT_KEY) || DEFAULT_STUDENT_ID;
}

function resolveStudent(studentId) {
  return mockStudents.find((student) => student.id === studentId) || mockStudents.find((student) => student.id === DEFAULT_STUDENT_ID) || mockStudents[0];
}

function getTeamsForStudent(student) {
  if (!student) {
    return [];
  }

  return mockTeams.filter((team) =>
    team.members.some((member) => member.id === student.id || member.studentId === student.studentId || member.email === student.email),
  );
}

export function useMockStudentSession() {
  const [activeStudentId, setActiveStudentId] = useState(getStoredStudentId);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(ACTIVE_STUDENT_KEY, activeStudentId);
  }, [activeStudentId]);

  const activeStudent = useMemo(() => resolveStudent(activeStudentId), [activeStudentId]);
  const activeStudentTeams = useMemo(() => getTeamsForStudent(activeStudent), [activeStudent]);

  return {
    activeStudent,
    activeStudentTeams,
    activeStudentId,
    setActiveStudentId,
    availableStudents: mockStudents,
  };
}
