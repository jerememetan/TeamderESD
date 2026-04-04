import { useEffect, useMemo, useState } from "react";
import { fetchAllStudents } from "./studentService";

const ACTIVE_STUDENT_KEY = "teamder.activeStudentId";
const BACKEND_UNAVAILABLE_ROUTE = "backend-unavailable";

function normalizeStudentRouteId(value) {
  return String(value ?? "").trim();
}

function studentRouteCandidates(student) {
  const idCandidate = normalizeStudentRouteId(student?.id);
  const studentIdCandidate = normalizeStudentRouteId(student?.studentId ?? student?.student_id);
  const backendStudentIdCandidate = normalizeStudentRouteId(student?.backendStudentId);

  return [idCandidate, studentIdCandidate, backendStudentIdCandidate].filter(Boolean);
}

function findStudentByRouteId(routeStudentId, students) {
  const normalizedRouteStudentId = normalizeStudentRouteId(routeStudentId);
  if (!normalizedRouteStudentId) {
    return null;
  }

  return (
    students.find((student) =>
      studentRouteCandidates(student).some(
        (candidate) => normalizeStudentRouteId(candidate) === normalizedRouteStudentId,
      ),
    ) || null
  );
}

function getStoredStudentId() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(ACTIVE_STUDENT_KEY) || "";
}

function persistStudentId(studentId) {
  if (typeof window === "undefined") {
    return;
  }

  if (studentId) {
    window.localStorage.setItem(ACTIVE_STUDENT_KEY, studentId);
  } else {
    window.localStorage.removeItem(ACTIVE_STUDENT_KEY);
  }
}

export function getPreferredStudentRouteId() {
  return getStoredStudentId() || BACKEND_UNAVAILABLE_ROUTE;
}

export function useStudentSession(routeStudentId, options = {}) {
  const { deferStudentsLoad = false } = options;
  const normalizedRouteStudentId = normalizeStudentRouteId(routeStudentId);
  const [activeStudentId, setActiveStudentId] = useState(() => normalizedRouteStudentId || getStoredStudentId());
  const [availableStudents, setAvailableStudents] = useState([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [studentLoadError, setStudentLoadError] = useState("");

  useEffect(() => {
    let ignore = false;
    let deferredLoadHandle = null;

    async function loadStudents() {
      setIsLoadingStudents(true);
      setStudentLoadError("");

      try {
        const backendStudents = await fetchAllStudents();
        if (ignore) {
          return;
        }

        setAvailableStudents(backendStudents);
        if (!backendStudents.length) {
          setStudentLoadError("The backend student service returned no students.");
        }
      } catch (error) {
        if (!ignore) {
          setAvailableStudents([]);
          setStudentLoadError(error?.message || "Unable to connect to the backend student service.");
        }
      } finally {
        if (!ignore) {
          setIsLoadingStudents(false);
        }
      }
    }

    if (deferStudentsLoad) {
      deferredLoadHandle = window.setTimeout(() => {
        loadStudents();
      }, 0);
    } else {
      loadStudents();
    }

    return () => {
      ignore = true;
      if (deferredLoadHandle !== null) {
        window.clearTimeout(deferredLoadHandle);
      }
    };
  }, [deferStudentsLoad]);

  useEffect(() => {
    if (!normalizedRouteStudentId) {
      return;
    }

    setActiveStudentId(normalizedRouteStudentId);
  }, [normalizedRouteStudentId]);

  useEffect(() => {
    if (normalizedRouteStudentId || isLoadingStudents || activeStudentId || !availableStudents.length) {
      return;
    }

    const firstAvailableStudentId = normalizeStudentRouteId(availableStudents[0]?.id || availableStudents[0]?.studentId);
    if (firstAvailableStudentId) {
      setActiveStudentId(firstAvailableStudentId);
    }
  }, [activeStudentId, availableStudents, isLoadingStudents, normalizedRouteStudentId]);

  useEffect(() => {
    persistStudentId(activeStudentId);
  }, [activeStudentId]);

  const activeStudent = useMemo(() => {
    const routeMatch = normalizedRouteStudentId ? findStudentByRouteId(normalizedRouteStudentId, availableStudents) : null;
    if (routeMatch) {
      return routeMatch;
    }

    const storedMatch = activeStudentId ? findStudentByRouteId(activeStudentId, availableStudents) : null;
    if (storedMatch) {
      return storedMatch;
    }

    if (!normalizedRouteStudentId && availableStudents.length) {
      return availableStudents[0];
    }

    return null;
  }, [activeStudentId, availableStudents, normalizedRouteStudentId]);

  const activeStudentRouteId = useMemo(() => {
    if (activeStudent) {
      return studentRouteCandidates(activeStudent)[0] || normalizeStudentRouteId(activeStudent.id) || normalizeStudentRouteId(activeStudent.studentId);
    }

    if (normalizedRouteStudentId) {
      return normalizedRouteStudentId;
    }

    if (activeStudentId) {
      return normalizeStudentRouteId(activeStudentId);
    }

    return BACKEND_UNAVAILABLE_ROUTE;
  }, [activeStudent, activeStudentId, normalizedRouteStudentId]);

  const activeStudentBackendId = useMemo(() => {
    if (!activeStudent) {
      return null;
    }

    const backendStudentId = Number(activeStudent.backendStudentId);
    return Number.isFinite(backendStudentId) ? backendStudentId : null;
  }, [activeStudent]);

  return {
    activeStudent,
    activeStudentRouteId,
    activeStudentId,
    activeStudentBackendId,
    availableStudents,
    isLoadingStudents,
    studentLoadError,
    setActiveStudentId,
  };
}
