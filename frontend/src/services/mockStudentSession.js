import { useEffect, useMemo, useState } from "react";
import { mockStudents, mockTeams } from "../data/mockData";
import { fetchAllStudents } from "./studentService";

const ACTIVE_STUDENT_KEY = "teamder.activeStudentId";
const DEFAULT_STUDENT_ID = "s12";

function getStoredStudentId() {
  if (typeof window === "undefined") {
    return DEFAULT_STUDENT_ID;
  }

  return window.localStorage.getItem(ACTIVE_STUDENT_KEY) || DEFAULT_STUDENT_ID;
}

function resolveStudent(studentId, students) {
  return (
    students.find((student) => student.id === studentId) ||
    students.find((student) => student.id === DEFAULT_STUDENT_ID) ||
    students[0]
  );
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
  const [availableStudents, setAvailableStudents] = useState(mockStudents);

  useEffect(() => {
    let ignore = false;

    async function loadStudents() {
      try {
        const backendStudents = await fetchAllStudents();
        if (!ignore && backendStudents.length) {
          setAvailableStudents(backendStudents);
        }
      } catch {
        // Keep mock data if backend student service is unavailable.
      }
    }

    loadStudents();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!availableStudents.length) {
      return;
    }

    const hasActiveStudent = availableStudents.some((student) => student.id === activeStudentId);
    if (!hasActiveStudent) {
      setActiveStudentId(availableStudents[0].id);
    }
  }, [activeStudentId, availableStudents]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(ACTIVE_STUDENT_KEY, activeStudentId);
  }, [activeStudentId]);

  const activeStudent = useMemo(
    () => resolveStudent(activeStudentId, availableStudents),
    [activeStudentId, availableStudents],
  );
  const activeStudentTeams = useMemo(() => getTeamsForStudent(activeStudent), [activeStudent]);

  return {
    activeStudent,
    activeStudentTeams,
    activeStudentId,
    setActiveStudentId,
    availableStudents,
  };
}
